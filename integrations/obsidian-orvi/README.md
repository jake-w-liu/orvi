# Orvi for Obsidian

This is a community-plugin-ready scaffold for rendering Orvi inside Obsidian preview.

## Features

- Renders fenced code blocks tagged as `orvi`.
- Registers `.ov` files as Markdown so Obsidian can open them.
- Replaces `.ov` preview content with Orvi-rendered HTML.
- Ships static CSS and a copied Orvi renderer runtime. No network access is used.

## Build

From the repository root:

```sh
npm run build
node integrations/obsidian-orvi/build.mjs
```

The build script copies the CommonJS Orvi renderer runtime from `dist/` into `integrations/obsidian-orvi/runtime/` and refreshes `styles.css` from `src/orvi-base.css`.

## Install Locally

Copy these files into your vault at `.obsidian/plugins/orvi/`:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`
- `runtime/`

Then enable **Orvi** from Obsidian's community plugins settings.
