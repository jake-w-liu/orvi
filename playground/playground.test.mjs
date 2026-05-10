import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_SOURCE, renderPreview } from "./app.mjs";

test("playground shell loads the module editor", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /id="lux-source"/);
  assert.match(html, /id="preview"/);
  assert.match(html, /src="\.\/app\.mjs"/);
});

test("playground render wrapper uses the Lux runtime result", () => {
  const rendered = renderPreview(DEFAULT_SOURCE, {
    renderLux(source) {
      assert.match(source, /# Welcome to Lux/);
      return {
        html: '<main class="lux-document"><h1>Welcome to Lux</h1></main>',
        ast: { diagnostics: [] }
      };
    }
  });

  assert.match(rendered.html, /lux-document/);
  assert.deepEqual(rendered.diagnostics, []);
});
