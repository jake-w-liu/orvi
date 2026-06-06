# Orvi Release Runbook

This runbook tracks the release paths that are already wired in this repository.

## GitHub package release (`orvi-lang`)

**Canonical distribution:** GitHub Releases. The package tarball attached to the
latest release installs through npm without using the npm registry:

```sh
npm install https://github.com/jake-w-liu/orvi/releases/latest/download/orvi-lang.tgz
```

The unscoped npm name `orvi` is rejected by npm's name-similarity guard (too
close to `ora` / `mri`), and the `@orvi` org name is unavailable, so package
metadata still uses `orvi-lang`. The package metadata, `bin` (`orvi`), `exports`
map (`./parser`, `./renderer`, `./formatter`, `./artifact`,
`./prettier-plugin`, `./react`, `./orvi-base.css` subpaths), `files` allowlist,
and `repository` field live in the root `package.json`. The package is also
marked `private: true`, has a `prepublishOnly` blocker, and points
`publishConfig.registry` at an invalid host so npm registry publishing is
blocked; `npm pack` still creates the GitHub Release tarball.

Releasing a new version:

- Bump the version first (`npm version patch|minor|major --no-git-tag-version`)
  and add the matching `## <version>` section to `CHANGELOG.md`.
- Commit the version bump, then push a tag `v<version>` (for example,
  `git tag v2.0.3 && git push origin main v2.0.3`).

`.github/workflows/release.yml` triggers on `v*` tags. It checks that the tag
matches `package.json`'s version, runs `npm ci`, runs `npm run verify` with
`ORVI_REQUIRE_BROWSER=1` (which rebuilds `dist/` and requires the browser render
smoke), runs `npm pack`, then creates or updates the GitHub Release with the
matching `CHANGELOG.md` section (extracted by
`scripts/extract-changelog.mjs`). It uploads:

- the versioned package tarball (`orvi-lang-<version>.tgz`)
- the stable package alias (`orvi-lang.tgz`) for `/releases/latest/download/`
  installs
- `orvi-language.vsix`
- `obsidian-orvi-plugin.zip`

Manual `workflow_dispatch` is available for an existing tag. Pass the tag name
(for example, `v2.0.3`) to create or refresh its GitHub Release. This is useful
when a tag exists but the release needs to be regenerated.

Manual package build:

```sh
npm ci
npm run verify        # rebuilds dist/ and runs the full suite
npm pack              # creates orvi-lang-<version>.tgz
```

## No npm registry publishing

Do not publish this repo to the npm registry. The repo intentionally has no
`NPM_TOKEN` requirement, no `npm publish` workflow, and the root
`package.json` has `private: true`, a `prepublishOnly` blocker, and an invalid
`publishConfig.registry` so `npm publish` is blocked even if someone runs it
locally. Distribution goes through GitHub Release assets.

## VS Code extension distribution

- Extension: `jake-w-liu.orvi-language`
- Version: `0.1.10` is prepared in this repo.

There is no Azure-backed automation in this repo. The VS Code Marketplace
requires an Azure DevOps PAT (`vsce publish`) and an Azure DevOps publisher
sign-in, so it is not wired here. The supported distribution paths are the
GitHub Release VSIX and Open VSX, both Azure-free.

### Local package / install

```sh
npm ci
npm --prefix vscode/orvi ci
npm run vscode:package -- --out orvi-language.vsix
code --install-extension orvi-language.vsix --force
```

The generated `.vsix` is ignored by git. `.github/workflows/release.yml` uploads
`orvi-language.vsix` to every tagged GitHub Release. The standalone
`.github/workflows/package-vscode.yml` workflow runs the same build via
`workflow_dispatch` and uploads the VSIX as a workflow artifact — no token
required.

## GitHub Release VSIX

GitHub Releases are the primary token-free distribution path. The tag release
workflow attaches a stable `orvi-language.vsix` asset, so users can install it
directly:

```sh
code --install-extension orvi-language.vsix
```

## Open VSX

Open VSX is the non-Microsoft, Azure-free registry used by editors such as
VSCodium and Theia. It has its own account gate:

- an eclipse.org account
- an open-vsx.org login through GitHub
- the open-vsx.org profile linked to the eclipse.org account
- a signed Open VSX Publisher Agreement
- an Open VSX access token saved as the `OVSX_PAT` repository secret
- a namespace matching the extension publisher, currently `jake-w-liu`

The access token is displayed only once when generated. Namespace creation is
separate from verified namespace ownership; verification can be claimed later.

One-time namespace creation:

```sh
npx --yes ovsx create-namespace jake-w-liu -p "$OVSX_PAT"
```

Manual publish from a packaged VSIX:

```sh
npx --yes ovsx publish orvi-language-0.1.10.vsix -p "$OVSX_PAT"
```

After `OVSX_PAT` and the Open VSX account/namespace prerequisites are
configured, `.github/workflows/publish-open-vsx.yml` packages and publishes the
exact VSIX it uploads as a workflow artifact.

## Obsidian plugin

The Obsidian plugin lives in `integrations/obsidian-orvi`. It is distributed as
a downloadable bundle (`manifest.json`, `main.js`, `styles.css`, `versions.json`,
`runtime/`) — Azure-free, like everything else here.

- Bump the version: `node scripts/set-obsidian-version.mjs <major.minor.patch>`
  (updates `manifest.json` and adds the `version -> minAppVersion` entry to
  `versions.json`, the layout Obsidian's community store requires).
- Build the runtime: `npm run obsidian:build`.
- `.github/workflows/release.yml` uploads `obsidian-orvi-plugin.zip` to every
  tagged GitHub Release.
- `.github/workflows/package-obsidian.yml` (`workflow_dispatch`, with an
  optional `version` input) does both and uploads the bundle as a workflow
  artifact.

Submitting to the Obsidian community store is a manual PR to
`obsidianmd/obsidian-releases` and is not automated here.

## GitHub Pages

GitHub Pages is enabled for this repository with `build_type: workflow`.

The Pages workflow at `.github/workflows/deploy-pages.yml` builds:

- `/playground/`
- `/rendered/` HTML previews for repository `.ov` files
- `/schemas/`
- `/version.json`

After each successful Pages deployment, the workflow keeps the newest
`github-pages` deployment record and deletes older records so the repository
sidebar does not accumulate stale Pages deployments.

The default Pages URL is:

```text
https://jake-w-liu.github.io/orvi/
```

Custom-domain publishing is gated by the repository variable
`ORVI_PAGES_CNAME`. Do not set this variable until DNS for the custom domain
already points to GitHub Pages; otherwise the working `github.io` URL redirects
to the wrong site.

To activate `orvi.dev` later:

1. In the DNS provider that owns `orvi.dev`, replace the current apex
   records with GitHub Pages records.
2. Set `www.orvi.dev` as a CNAME to `jake-w-liu.github.io`.
3. Set the repository variable `ORVI_PAGES_CNAME` to `orvi.dev`.
4. Re-run the Pages workflow.
5. Configure `orvi.dev` in GitHub Pages settings and enable HTTPS after
   certificate issuance.

Required DNS records:

```text
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
AAAA  @     2606:50c0:8000::153
AAAA  @     2606:50c0:8001::153
AAAA  @     2606:50c0:8002::153
AAAA  @     2606:50c0:8003::153
CNAME www   jake-w-liu.github.io
```

As of the latest check on 2026-05-11, RDAP reports `orvi.dev` as not registered
and DNS returns no records. Register the domain first, then point it at GitHub
Pages before setting `ORVI_PAGES_CNAME`.

## Native GitHub `.ov` Rendering

**Decision:** GitHub.com does not let a repository register a custom renderer for
a new file extension, so true native rendering — GitHub showing a `.ov` file as
formatted output in the repository file view — is not achievable from this repo.
It would require GitHub itself to add an Orvi renderer. The shipped fallback is
GitHub Pages previews generated by `scripts/build-site.mjs` (linked from the
README). This decision stands until GitHub platform support exists.

Native rendering is distinct from two things GitHub *does* support for new
languages, both routed through [github-linguist](https://github.com/github-linguist/linguist):

- syntax highlighting of `.ov` files in the file view
- language classification in the repository language bar / stats

### github-linguist submission

The complete, copy-pasteable submission kit lives in
[`docs/linguist-submission.md`](linguist-submission.md): the `languages.yml`
entry, the `grammars.yml` mapping, the submodule steps, the `language_id`
procedure, and the sample-file requirement. The grammar
(`vscode/orvi/syntaxes/orvi.tmLanguage.json`, scope `source.orvi`) and the MIT
license are already in place.

**Gate:** Linguist only accepts a new language once it is in real cross-repo use
(hundreds of `.ov` files across multiple public repositories). Orvi does not meet
that bar yet, so the kit is prepared but the PR is parked until usage exists.
Until then, the repo root `.gitattributes` carries `*.ov linguist-language=Markdown`
so github.com gives `.ov` files Markdown-grade highlighting in the interim.
