# github-linguist Submission Kit for Orvi

This is the ready-to-use kit for adding `.ov` (Orvi) to
[github-linguist](https://github.com/github-linguist/linguist), which is what
makes GitHub.com highlight `.ov` files in the blob view and count them in the
repository language bar. Native GitHub *rendering* of `.ov` (showing it as
formatted output) is a separate, GitHub-internal feature and is not in scope —
see `docs/release.md`.

## Status / the adoption gate

Linguist only accepts a new language once it is in **real cross-repo use** —
roughly hundreds of `.ov` files across multiple public repositories on
GitHub.com. Orvi does not meet that bar yet, so opening the PR now would get it
closed as premature. Until then:

- The repo root `.gitattributes` carries `*.ov linguist-language=Markdown` as an
  interim measure, so github.com gives `.ov` files Markdown-grade highlighting
  today (imperfect for `[...]` syntax).
- Track adoption; when `.ov` is widespread, follow the steps below — it is a
  ~30-minute submission.

## What is already in place

| Requirement | Status |
| --- | --- |
| TextMate-compatible grammar | `vscode/orvi/syntaxes/orvi.tmLanguage.json`, `scopeName: source.orvi`, kept in sync with the parser |
| OSI-approved grammar license | This repo is MIT (`LICENSE`), so it can be the grammar source repo |
| Sample files | `examples/welcome.ov` (add more real-world `.ov` files over time) |
| Unique scope name | `source.orvi` — not used by any existing Linguist grammar |

## Submission steps (against a fork of `github-linguist/linguist`)

1. **Add the grammar as a submodule** (this also updates `vendor/README.md` and
   `grammars.yml` for you):

   ```sh
   bundle exec rake add_grammar[https://github.com/jake-w-liu/orvi]
   ```

   If you prefer to do it by hand: `git submodule add https://github.com/jake-w-liu/orvi vendor/grammars/orvi`,
   add an alphabetical credit line to `vendor/README.md`, and add the scope
   mapping to `grammars.yml`:

   ```yaml
   vendor/grammars/orvi:
   - source.orvi
   ```

   Linguist's grammar scanner finds the grammar file at
   `vscode/orvi/syntaxes/orvi.tmLanguage.json` inside the submodule
   automatically; no extra configuration is needed.

2. **Add the language to `lib/linguist/languages.yml`** (alphabetical order):

   ```yaml
   Orvi:
     type: prose
     color: "#6f57c7"
     extensions:
     - ".ov"
     tm_scope: source.orvi
     ace_mode: text
     language_id: 0   # placeholder — see step 3
   ```

   Notes:
   - `type: prose` matches Markdown/AsciiDoc/etc.
   - No `group:` — Orvi is its own language, not a Markdown dialect.
   - Omit `codemirror_mode` / `codemirror_mime_type` (no CodeMirror mode).

3. **Assign `language_id`.** Do not pick one by hand. Run Linguist's helper so it
   gets a collision-free id:

   ```sh
   script/set-language-ids
   # or, if that script is unavailable in the checkout:
   bundle exec rake check_language_ids   # then fill the suggested id
   ```

4. **Add sample files** under `samples/Orvi/`. Use real `.ov` files from public
   repositories (the classifier wants real-world code, not synthetic snippets).
   `examples/welcome.ov` from this repo is a fair starting sample; add several
   more covering metadata blocks, grids, callouts, tabs, tables, and code fences.

5. **Validate and rebuild the classifier:**

   ```sh
   bundle exec rake samples       # rebuild the classifier database
   bundle exec rake test
   script/cross-validation        # sanity-check classification accuracy
   ```

6. **Open the PR** to `github-linguist/linguist`. In the description, link this
   repo as the grammar source, link the Orvi spec (`orvi-spec-v0.1.md`), and
   include the cross-repo `.ov` usage evidence (the GitHub code-search count)
   that satisfies the adoption gate.

## Reference values (copy-paste)

- Grammar repo: `https://github.com/jake-w-liu/orvi`
- Grammar file (inside submodule): `vscode/orvi/syntaxes/orvi.tmLanguage.json`
- Scope name: `source.orvi`
- Extension(s): `.ov`
- Suggested color: `#6f57c7`
- Suggested `ace_mode`: `text`
- Language type: `prose`
