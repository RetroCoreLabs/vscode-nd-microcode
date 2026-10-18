# Contributing

## Documentation site

The site is built with MkDocs and the Material theme and published on GitHub
Pages: <https://retrocorelabs.github.io/nd-microcode/>

| What | Where |
|------|-------|
| Pages written by hand | `README.md`, `CHANGELOG.md`, `docs/*.md` |
| Pages made from the code | `docs/variants/*.md` |
| Navigation | `docs-site/mkdocs.yml` (made by the script) |
| Settings of the site | `docs-site/base.yml` |
| Link rewriting | `docs-site/hooks.py` |
| Pinned packages | `docs-site/requirements.txt` |

### Regenerate the pages

From the repository root, with Python 3.10 or newer and PyYAML:

```bash
python3 scripts/gen_docs.py            # write docs/variants/*.md and docs-site/mkdocs.yml
python3 scripts/gen_docs.py --check    # write nothing; exit 1 if a file is out of date
```

The script reads `src/generated/definitions.json`, `src/core/models.ts` and
`external/meta/lib/ts/src/types.ts` (the submodule must be checked out).
Run it again after `npm run generate` has changed `definitions.json`, and
commit the result.

### Build and look at the site

From the repository root:

```bash
python3 -m venv docs-site/.venv
docs-site/.venv/bin/pip install -r docs-site/requirements.txt
docs-site/.venv/bin/mkdocs build --strict -f docs-site/mkdocs.yml -d "$SITE_OUT"
```

`SITE_OUT` is a folder outside the checkout (MkDocs refuses an output folder
inside the docs folder, and the docs folder here is the repository root).
`--strict` turns every warning, such as a broken link, into an error.
`mkdocs serve -f docs-site/mkdocs.yml` shows the site while editing.

### Publish

`.github/workflows/docs.yml` runs on each push to `main`: it checks that the
generated pages are up to date, builds the site with `--strict` and
deploys it. In the repository settings, Pages > Source must be
**GitHub Actions**.
