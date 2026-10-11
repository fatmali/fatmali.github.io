import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const categories = {
  everyday: "Everyday life",
  developer: "Developer brain",
  learning: "Learning things",
  play: "Just because",
};

export const artNames = new Set(["frank", "jambo", "still", "herd", "food", "book", "wormhole", "guide", "receipt", "tasks", "lift", "wizard", "camera", "home", "spark"]);
export const root = new URL("../", import.meta.url);

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function validateProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) throw new Error("The project catalog must be a nonempty array.");
  const names = new Set();
  for (const project of projects) {
    if (!project || typeof project !== "object") throw new Error("Every project must be an object.");
    if (typeof project.repo !== "string" || !/^[a-z\d_.-]+$/i.test(project.repo)) throw new Error(`Invalid repository name: ${project.repo}`);
    if (names.has(project.repo.toLowerCase())) throw new Error(`Duplicate repository: ${project.repo}`);
    names.add(project.repo.toLowerCase());
    for (const field of ["title", "description", "type"]) {
      if (typeof project[field] !== "string" || !project[field].trim()) throw new Error(`${project.repo} needs a ${field}.`);
    }
    if (project.question != null && typeof project.question !== "string") throw new Error(`${project.repo} has an invalid question.`);
    if (!Object.hasOwn(categories, project.category)) throw new Error(`${project.repo} has an unknown category.`);
    if (!artNames.has(project.art)) throw new Error(`${project.repo} has unknown artwork.`);
    if (!/^#[\da-f]{6}$/i.test(project.color)) throw new Error(`${project.repo} has an invalid color.`);
    if (project.url === null) {
      if (typeof project.siteNote !== "string" || !project.siteNote.trim()) throw new Error(`${project.repo} needs an explanation for its missing site link.`);
    } else {
      const url = new URL(project.url);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${project.repo} needs a public HTTPS site URL.`);
    }
  }
}

export function renderProjects(projects) {
  validateProjects(projects);
  return projects.map(project => {
    const e = escapeHtml;
    const repository = `https://github.com/fatmali/${project.repo}`;
    const searchable = [project.title, project.repo, project.description, project.question, project.type, categories[project.category]].filter(Boolean).join(" ").toLocaleLowerCase();
    return `        <article class="project" id="project-${e(project.repo)}" data-category="${e(project.category)}" data-search="${e(searchable)}">
          <div class="project-art" style="--art-bg: ${e(project.color)}" aria-hidden="true">
            <span class="project-category">${e(categories[project.category])}</span>
            <svg viewBox="0 0 360 230" focusable="false"><use href="/assets/project-art.svg#${e(project.art)}"></use></svg>
          </div>
          <div class="project-body">
            <div class="project-title-row"><h3><a class="project-title-link" href="${e(project.url ?? repository)}">${e(project.title)}</a></h3><span class="project-type">${e(project.type)}</span></div>
            <p class="project-description">${e(project.description)}</p>
            ${project.question ? `<p class="project-question"><strong>The what-if:</strong> ${e(project.question)}</p>` : ""}
            <div class="project-links">
              ${project.url ? `<a class="project-visit" href="${e(project.url)}">Explore project <span aria-hidden="true">↗</span><span class="sr-only">: ${e(project.title)}</span></a>` : `<span class="project-warning">${e(project.siteNote)}</span>`}
              <a class="project-source" href="${e(repository)}">View source<span class="sr-only"> for ${e(project.title)}</span></a>
            </div>
          </div>
        </article>`;
  }).join("\n");
}

export function renderCatalog(html, projects) {
  const cards = renderProjects(projects);
  const section = /<!-- projects:start -->[\s\S]*?<!-- projects:end -->/g;
  const count = /<!-- count:start -->[\s\S]*?<!-- count:end -->/g;
  if ([...html.matchAll(section)].length !== 1 || [...html.matchAll(count)].length !== 1) {
    throw new Error("Expected exactly one project section and one count marker in index.html.");
  }
  return html
    .replace(section, () => `<!-- projects:start -->\n${cards}\n        <!-- projects:end -->`)
    .replace(count, () => `<!-- count:start -->${projects.length}<!-- count:end -->`);
}

export async function updateHomepage({ check = false } = {}) {
  const projects = JSON.parse(await readFile(new URL("data/projects.json", root), "utf8"));
  const path = new URL("index.html", root);
  const html = await readFile(path, "utf8");
  const rendered = renderCatalog(html, projects);
  if (check && html !== rendered) throw new Error("The homepage catalog is stale. Run node scripts/catalog.mjs.");
  if (!check && html !== rendered) await writeFile(path, rendered);
  console.log(`${projects.length} projects ${check ? "verified" : "rendered"} in index.html.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(argument => argument !== "--check")) throw new Error("Usage: node scripts/catalog.mjs [--check]");
  await updateHomepage({ check: process.argv.includes("--check") });
}
