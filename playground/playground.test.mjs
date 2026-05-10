import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_SOURCE, renderPreview } from "./app.mjs";

test("playground shell loads the module editor", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /id="orvi-source"/);
  assert.match(html, /id="preview"/);
  assert.match(html, /src="\.\/app\.mjs"/);
});

test("playground render wrapper uses the Orvi runtime result", () => {
  const rendered = renderPreview(DEFAULT_SOURCE, {
    renderOrvi(source) {
      assert.match(source, /# Welcome to Orvi/);
      return {
        html: '<main class="orvi-document"><h1>Welcome to Orvi</h1></main>',
        ast: { diagnostics: [] }
      };
    }
  });

  assert.match(rendered.html, /orvi-document/);
  assert.deepEqual(rendered.diagnostics, []);
});
