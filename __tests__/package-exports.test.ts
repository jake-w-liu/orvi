import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

const packageRoot = resolve(__dirname, "..");

interface PackedFile {
  path: string;
}

interface PackResult {
  files: PackedFile[];
}

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

  it("exposes a stable, frozen public runtime surface from the main entry", () => {
    // Guard against accidental additions/removals to the public API. The React
    // binding is intentionally NOT here — it lives at "orvi-lang/react".
    const mainEntry = execFileSync(
      process.execPath,
      ["-e", "console.log(Object.keys(require('./dist/index.js')).sort().join(','))"],
      { cwd: packageRoot, encoding: "utf8" }
    ).trim();
    expect(mainEntry.split(",")).toEqual([
      "OrviParser",
      "defaultCss",
      "formatOrvi",
      "formatOrviFromAst",
      "parseOrvi",
      "renderOrvi",
      "renderOrviArtifact",
      "renderToHtml",
      "walk"
    ]);

    const reactEntry = execFileSync(
      process.execPath,
      ["-e", "console.log(Object.keys(require('./dist/react.js')).sort().join(','))"],
      { cwd: packageRoot, encoding: "utf8" }
    ).trim();
    expect(reactEntry.split(",")).toEqual(["OrviRenderer", "default"]);

    // Every exports-map subpath resolves to an emitted declaration file.
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
      exports: Record<string, { types?: string } | string>;
    };
    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      if (typeof entry === "string") continue;
      if (!entry.types) throw new Error(`exports["${subpath}"] is missing a types entry`);
      expect(() => readFileSync(resolve(packageRoot, entry.types!), "utf8")).not.toThrow();
    }
  });

  it("declares industrial packaging metadata", () => {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
      sideEffects?: unknown;
      engines?: { node?: string };
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
      bin?: Record<string, string>;
    };
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.engines?.node).toBeDefined();
    expect(pkg.engines!.node).toMatch(/>=\s*20/);
    expect(pkg.peerDependenciesMeta?.react?.optional).toBe(true);
  });

  it("publishes the runtime and assets but no tests, site, or coverage", () => {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: packageRoot,
      encoding: "utf8"
    });
    const [result] = JSON.parse(output) as PackResult[];
    const paths = result.files.map((file) => file.path);

    // Shipped.
    expect(paths).toEqual(expect.arrayContaining(["package.json", "CHANGELOG.md", "dist/cli.js", "dist/index.js"]));
    expect(paths.some((p) => p.startsWith("dist/esm/"))).toBe(true);
    expect(paths).toContain("src/orvi-base.css");

    // Never shipped.
    expect(paths.some((p) => p.startsWith("__tests__/"))).toBe(false);
    expect(paths.some((p) => p.startsWith(".site/") || p === ".site")).toBe(false);
    expect(paths.some((p) => p.startsWith("coverage/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("benchmarks/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("playground/"))).toBe(false);
    expect(paths.some((p) => p.endsWith(".test.ts") || p.endsWith(".test.mjs"))).toBe(false);
  });
});
