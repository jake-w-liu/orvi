# Lux for Obsidian

This is a community-plugin-ready scaffold for rendering Lux inside Obsidian preview.

## Features

- Renders fenced code blocks tagged as `lux`.
- Registers `.lux` files as Markdown so Obsidian can open them.
- Replaces `.lux` preview content with Lux-rendered HTML.
- Ships static CSS and a copied Lux renderer runtime. No network access is used.

## Build

From the repository root:

```sh
npm run build
node integrations/obsidian-lux/build.mjs
```

The build script copies the CommonJS Lux renderer runtime from `dist/` into `integrations/obsidian-lux/runtime/` and refreshes `styles.css` from `src/lux-base.css`.

## Install Locally

Copy these files into your vault at `.obsidian/plugins/lux/`:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`
- `runtime/`

Then enable **Lux** from Obsidian's community plugins settings.
