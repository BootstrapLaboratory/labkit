# Bash Module Layout Convention

```text
path/to/module/
  README.md
  docs/
    DOC1.md
    DOC2.md
    DOC3.md
  config/
    .env
    .env.example
    .env.local
  scripts/
    script1.sh
    script2.sh
    load-env.sh       ---> loads `config/.env`
    script3.sh
    lib/
      paths.sh        ---> sets named directory variables for (module/config/docs/scripts/tests), so bash/shell/etc scripts have a universal way to find sibling files without depending on the current working directory
  tests/
    test1.sh
    test2.sh
```

Why I recommend this:

- `docs/` keeps Markdown out of the way.
- `scripts/` is only for real operational entrypoints.
- `tests/` stays separate from operational scripts, which makes the folder easier to scan.
- `config/` makes it obvious that `.env` files are not scripts and not docs.
- `.env.local` gives you an optional local override file without forcing per-machine changes into `.env`.
- `.gitignore` should usually ignore `config/.env` and `config/.env.local`.
- `README.md` stays at the `path/to/module/` root as the index page.

The important implementation rule is this:

- every shell script should resolve `MODULE_DIR` from its own file path, never from the current working directory
- all env loading should go through one file only: `scripts/load-env.sh`
- if you want near-zero future path churn, add `scripts/lib/paths.sh` and make every shell entrypoint source that first
- use a specific, collision-safe variable name such as `CLOUDRUN_DIR` or `CLOUDFLARE_PAGES_DIR` when the file is meant to be sourced by other scripts; a local `MODULE_DIR` is fine for standalone scripts

That gives you path stability. Then a whole module directory can be moved elsewhere in the repo without rewriting every script.
