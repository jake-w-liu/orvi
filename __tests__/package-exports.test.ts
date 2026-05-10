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
          "const lux = require('./dist');",
          "const parser = require('./dist/parser');",
          "const renderer = require('./dist/renderer');",
          "console.log(typeof lux.parseLux, typeof parser.parseLux, typeof renderer.renderLux);"
        ].join("")
      ],
      { cwd: packageRoot, encoding: "utf8" }
    );

    expect(output.trim()).toBe("function function function");
  });

  it("supports ESM entrypoints", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          "const lux = await import('./dist/esm/index.js');",
          "const parser = await import('./dist/esm/parser.js');",
          "const renderer = await import('./dist/esm/renderer.js');",
          "console.log(typeof lux.parseLux, typeof parser.parseLux, typeof renderer.renderLux);"
        ].join("")
      ],
      { cwd: packageRoot, encoding: "utf8" }
    );

    expect(output.trim()).toBe("function function function");
  });
});
