# Fatma's Lab

The weekend-project home of [Fatma Ali](https://fatmaali.dev), hosted at
[lab.fatmaali.dev](https://lab.fatmaali.dev). Serious product instincts,
unserious weekend energy.

The homepage is plain HTML, CSS, and JavaScript. All projects are rendered into
the committed HTML, so the collection works without JavaScript, a runtime API
request, or a build tool. JavaScript adds category filters, search, and a random
side-quest picker. Fonts and original vector artwork are served locally.

## Preview

From the repository root:

```sh
python3 -m http.server 4000 --bind 127.0.0.1
```

Open <http://127.0.0.1:4000>. The new homepage requires no package installation.
The existing Jekyll configuration remains in place for the older blog routes.

## Project collection

`data/projects.json` is the source of truth for the cards. It includes every
public repository owned by `fatmali` with GitHub Pages enabled, except this
homepage itself. Forks and archived repositories are not silently excluded.
The personal site is included too.

Edit the title, description, question, category, artwork, color, or canonical
URL there, then regenerate the static HTML with Node 22 or newer:

```sh
node scripts/catalog.mjs
```

Do not edit the generated project section or count inside `index.html` by hand.
The surrounding page is ordinary hand-authored HTML.

Discover new Pages repositories and remove repositories that no longer have
public Pages enabled:

```sh
node scripts/sync-projects.mjs
```

Set `GITHUB_TOKEN` in the environment to avoid the lower unauthenticated API
rate limit. Do not put a token in client code or commit it. Refresh failures
stop with an error rather than replace the catalog with a partial result.
Existing editorial text, ordering, and explicit URL exceptions are preserved.
New projects get their repository description and the standard GitHub Pages URL,
which redirects to a custom domain when configured. Add their more personal
copy and artwork to the JSON when ready.

The **Refresh project catalog** workflow runs weekly on Monday at 07:17 UTC,
or manually from Actions. It proposes changes through a pull request on
`automation/refresh-project-catalog`, respecting the review requirement on
`master`. Review and merge that PR to publish through the normal Pages build.
GitHub Actions must be allowed to create pull requests in the repository's
Actions settings. The refresh runs the tests before proposing its changes;
PRs created with `GITHUB_TOKEN` do not automatically trigger another CI run.
GitHub may disable scheduled workflows in inactive public repositories after
60 days; re-enable the workflow in Actions if necessary.

### Site-link exceptions

Lift and herd are included, but their live-site links are withheld. Lift's
Pages configuration currently redirects to the main portfolio rather than
the training app; herd's Pages site returns HTTP 404. Their source links
remain accessible. Once either deployment is fixed, set its `url` and remove
`siteNote` / `siteIssue` in the catalog, then regenerate. The refresh
intentionally does not undo these exceptions.

## Checks

```sh
node --test
node scripts/catalog.mjs --check
```

The checks cover catalog completeness, HTML escaping, allowed URLs and artwork,
API pagination and errors, missing destinations, and deterministic updates.
The **Check the lab** workflow runs them on pull requests and `master`.

## Hosting

GitHub Pages is configured to build the root of `master` with the existing
Jekyll setup. The homepage has no front matter, so Jekyll copies it unchanged.
`CNAME` remains `lab.fatmaali.dev`; this change does not modify DNS or the
separate main-site repository. Absolute asset paths assume this root-domain
deployment. For a project-subpath deployment, update those paths first.

The legacy Jekyll Now theme files retain their existing license. The lab's
Archivo Black and Manrope fonts are distributed under the SIL Open Font
License; their notices are in `assets/fonts/`.
