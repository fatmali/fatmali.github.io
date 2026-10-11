import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { root, renderCatalog, validateProjects } from "./catalog.mjs";

export async function fetchPagesRepositories(fetcher = fetch, token = process.env.GITHUB_TOKEN) {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const response = await fetcher(`https://api.github.com/users/fatmali/repos?type=owner&per_page=100&page=${page}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`GitHub repository discovery failed (HTTP ${response.status}). The saved catalog has not been changed.`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("GitHub returned an invalid repository list. The saved catalog has not been changed.");
    repositories.push(...batch.filter(repo => repo.has_pages === true && repo.private === false && repo.name !== "fatmali.github.io"));
    if (batch.length < 100) break;
  }
  return repositories;
}

export function mergeProjects(repositories, current) {
  const names = new Set(repositories.map(repo => repo.name));
  const projects = current.filter(project => names.has(project.repo));
  const existing = new Set(projects.map(project => project.repo));
  for (const repo of [...repositories].sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (existing.has(repo.name)) continue;
    projects.push({
      repo: repo.name,
      title: repo.name,
      description: repo.description?.trim() || "A new experiment has landed in the lab. Open the project or explore its source to see what's taking shape.",
      category: "play",
      type: "New experiment",
      art: "spark",
      color: "#e6e6fb",
      // The standard Pages address redirects to the site's custom domain when configured.
      url: `https://fatmali.github.io/${encodeURIComponent(repo.name)}/`,
    });
    existing.add(repo.name);
  }
  validateProjects(projects);
  return projects;
}

export async function synchronize() {
  const path = new URL("data/projects.json", root);
  const current = JSON.parse(await readFile(path, "utf8"));
  const repositories = await fetchPagesRepositories();
  const projects = mergeProjects(repositories, current);
  const homepage = new URL("index.html", root);
  const html = renderCatalog(await readFile(homepage, "utf8"), projects);
  await writeFile(path, `${JSON.stringify(projects, null, 2)}\n`);
  await writeFile(homepage, html);
  console.log(`Synced ${projects.length} public GitHub Pages projects. Editorial copy and explicit site-link exceptions were preserved.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await synchronize();
