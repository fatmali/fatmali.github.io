const cards = [...document.querySelectorAll(".project")];
const filters = [...document.querySelectorAll("[data-filter]")];
const search = document.querySelector("#project-search");
const status = document.querySelector("#results-status");
const emptyState = document.querySelector("#empty-state");
const surprise = document.querySelector("#surprise");
let category = "all";
let lastPick = null;

function applyFilters(announce = true) {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;

  for (const card of cards) {
    const matchesCategory = category === "all" || card.dataset.category === category;
    const matchesQuery = card.dataset.search.includes(query);
    card.hidden = !(matchesCategory && matchesQuery);
    card.classList.remove("project-selected");
    if (!card.hidden) count += 1;
  }

  for (const filter of filters) {
    filter.setAttribute("aria-pressed", String(filter.dataset.filter === category));
  }

  emptyState.hidden = count !== 0;
  surprise.disabled = count === 0;
  if (announce) status.textContent = `${count} ${count === 1 ? "experiment" : "experiments"} found.`;
}

for (const filter of filters) {
  filter.addEventListener("click", () => {
    category = filter.dataset.filter;
    applyFilters();
  });
}

search.addEventListener("input", () => applyFilters());

document.querySelector("#clear-filters").addEventListener("click", () => {
  category = "all";
  search.value = "";
  applyFilters();
  search.focus({ preventScroll: true });
});

surprise.addEventListener("click", () => {
  const visible = cards.filter(card => !card.hidden);
  const candidates = visible.length > 1 ? visible.filter(card => card !== lastPick) : visible;
  if (candidates.length === 0) return;
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  for (const card of cards) card.classList.toggle("project-selected", card === selected);
  selected.querySelector(".project-title-link").focus({ preventScroll: true });
  selected.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  status.textContent = `Your next side quest: ${selected.querySelector("h3").textContent}.`;
  lastPick = selected;
});

document.querySelector("#collection-controls").hidden = false;
surprise.hidden = false;
applyFilters(false);
