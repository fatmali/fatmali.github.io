import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { root, artNames, escapeHtml, validateProjects, renderProjects, renderCatalog, renderHomepage, versionAssetUrls } from "../scripts/catalog.mjs";
import { fetchPagesRepositories, mergeProjects } from "../scripts/sync-projects.mjs";

const projects = JSON.parse(await readFile(new URL("data/projects.json", root), "utf8"));
const html = await readFile(new URL("index.html", root), "utf8");
const example = projects[0];

test("the committed homepage contains the up-to-date catalog and asset versions", async () => {
  assert.equal(await renderHomepage(html, projects), html);
  assert.equal((html.match(/class="project"/g) || []).length, projects.length);
  for (const project of projects) assert.ok(html.includes(`id="project-${project.repo}"`));
});

test("asset versions are deterministic, change with content, and preserve SVG fragments", () => {
  const template = '<link href="/assets/lab.css"><script src="/assets/lab.js"></script><use href="/assets/project-art.svg#frank"></use>';
  const assets = { "assets/lab.css": "first styles", "assets/lab.js": "script", "assets/project-art.svg": "art" };
  const versioned = versionAssetUrls(template, assets);
  assert.match(versioned, /href="\/assets\/lab\.css\?v=[a-f0-9]{12}"/);
  assert.match(versioned, /src="\/assets\/lab\.js\?v=[a-f0-9]{12}"/);
  assert.match(versioned, /href="\/assets\/project-art\.svg\?v=[a-f0-9]{12}#frank"/);
  assert.equal(versionAssetUrls(versioned, assets), versioned);
  const updated = versionAssetUrls(versioned, { ...assets, "assets/lab.css": "changed styles" });
  assert.notEqual(updated.match(/href="[^"]+\.css[^"]+"/)[0], versioned.match(/href="[^"]+\.css[^"]+"/)[0]);
  assert.equal(updated.match(/src="[^"]+"/)[0], versioned.match(/src="[^"]+"/)[0]);
  assert.equal((updated.match(/\?v=/g) || []).length, 3);
  assert.throws(() => versionAssetUrls("", assets), /missing its assets\/lab.css reference/);
});

test("the main-site arrow has intrinsic dimensions even without its current CSS", () => {
  const icon = html.match(/class="home-link"[^>]*>[\s\S]*?(<svg\b[^>]*>)/)?.[1];
  assert.ok(icon, "The main-site link needs its SVG arrow.");
  assert.match(icon, /width="16"/);
  assert.match(icon, /height="16"/);
  assert.match(icon, /aria-hidden="true"/);
});

test("every project illustration exists", async () => {
  const art = await readFile(new URL("assets/project-art.svg", root), "utf8");
  for (const name of artNames) assert.ok(art.includes(`<symbol id="${name}"`), `Missing ${name} illustration`);
});

test("untrusted repository content is escaped, including replace-pattern syntax", () => {
  assert.equal(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  const malicious = { ...example, title: `<script>alert("x")</script>`, description: "$& $` $' <img onerror=alert(1)>" };
  const rendered = renderCatalog("<!-- projects:start --><!-- projects:end --><!-- count:start --><!-- count:end -->", [malicious]);
  assert.ok(!rendered.includes("<script>"));
  assert.ok(rendered.includes("&lt;img"));
  assert.ok(rendered.includes("$&amp;"));
});

test("invalid links, colors, duplicates and missing-link explanations fail explicitly", () => {
  for (const update of [{ url: "javascript:alert(1)" }, { url: "http://example.com" }, { color: "red;display:none" }, { art: "missing" }, { category: "toString" }, { url: null, siteNote: "" }]) {
    assert.throws(() => validateProjects([{ ...example, ...update }]));
  }
  assert.throws(() => validateProjects([example, example]), /Duplicate/);
});

test("broken destinations stay listed with a source link, not a misleading site link", () => {
  const project = { ...example, url: null, siteNote: "Site link under repair" };
  const rendered = renderProjects([project]);
  assert.ok(rendered.includes(project.siteNote));
  assert.ok(rendered.includes(`https://github.com/fatmali/${project.repo}`));
  assert.ok(!rendered.includes('class="project-visit"'));
});

test("missing or duplicate rendering markers fail instead of silently publishing an empty catalog", () => {
  assert.throws(() => renderCatalog("", projects), /exactly one/);
  assert.throws(() => renderCatalog(html + "<!-- projects:start --><!-- projects:end -->", projects), /exactly one/);
});

test("sync adds newly published sites, removes disabled sites, and preserves curated ordering and exceptions", () => {
  const current = [example, { ...projects[1], url: null, siteNote: "Under repair" }, { ...example, repo: "removed" }];
  const repositories = [{ name: "new-site", description: "A real description" }, { name: projects[1].repo }, { name: example.repo }];
  const merged = mergeProjects(repositories, current);
  assert.deepEqual(merged.slice(0, 2), current.slice(0, 2));
  assert.equal(merged[2].repo, "new-site");
  assert.equal(merged[2].description, "A real description");
  assert.equal(merged[2].url, "https://fatmali.github.io/new-site/");
  assert.equal(merged[2].question, undefined);
  assert.equal(merged.length, 3);
  assert.deepEqual(mergeProjects(repositories, merged), merged);
});

test("discovery paginates and excludes private repos, this homepage, and sites without Pages", async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ name: `repo-${index}`, private: false, has_pages: index === 0 }));
  const second = [
    { name: "last-page-site", private: false, has_pages: true },
    { name: "private-site", private: true, has_pages: true },
    { name: "fatmali.github.io", private: false, has_pages: true },
  ];
  const calls = [];
  const result = await fetchPagesRepositories(async url => {
    calls.push(url);
    return { ok: true, json: async () => calls.length === 1 ? first : second };
  }, "");
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith("page=2"));
  assert.deepEqual(result.map(repo => repo.name), ["repo-0", "last-page-site"]);
});

test("API failures and malformed responses stop the refresh", async () => {
  await assert.rejects(fetchPagesRepositories(async () => ({ ok: false, status: 403 }), ""), /HTTP 403/);
  await assert.rejects(fetchPagesRepositories(async () => ({ ok: true, json: async () => ({ error: "bad" }) }), ""), /invalid repository list/);
  assert.throws(() => mergeProjects([], projects), /nonempty array/);
});
