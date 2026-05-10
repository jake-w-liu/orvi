import { execFileSync } from "child_process";
import { resolve } from "path";

const packageRoot = resolve(__dirname, "..");

describe("package exports", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], {
      cwd: packageRoot,
      stdio: "pipe"
    });
  });

  it("supports CommonJS entrypoints", () => {
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        [
          "const orvi = require('./dist');",
          "const parser = require('./dist/parser');",
          "const renderer = require('./dist/renderer');",
          "const artifact = require('./dist/artifact');",
          "console.log(typeof orvi.parseOrvi, typeof parser.parseOrvi, typeof renderer.renderOrvi, typeof artifact.renderOrviArtifact);"
        ].join("")
      ],
      { cwd: packageRoot, encoding: "utf8" }
    );

    expect(output.trim()).toBe("function function function function");
  });

  it("supports ESM entrypoints", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          "const orvi = await import('./dist/esm/index.js');",
          "const parser = await import('./dist/esm/parser.js');",
          "const renderer = await import('./dist/esm/renderer.js');",
          "const artifact = await import('./dist/esm/artifact.js');",
          "console.log(typeof orvi.parseOrvi, typeof parser.parseOrvi, typeof renderer.renderOrvi, typeof artifact.renderOrviArtifact);"
        ].join("")
      ],
      { cwd: packageRoot, encoding: "utf8" }
    );

    expect(output.trim()).toBe("function function function function");
  });
});
