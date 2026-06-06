import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("release and deployment workflows", () => {
  it("uses maintained first-party GitHub Action majors", () => {
    const workflows = workflowPaths.map(read).join("\n");

    expect(workflows).not.toContain("actions/checkout@v4");
    expect(workflows).not.toContain("actions/setup-node@v4");
    expect(workflows).not.toContain("actions/upload-artifact@v4");
    expect(workflows.match(/actions\/checkout@v6/g)?.length ?? 0).toBeGreaterThan(0);
    expect(workflows.match(/actions\/setup-node@v6/g)?.length ?? 0).toBeGreaterThan(0);
    expect(workflows.match(/actions\/upload-artifact@v7/g)?.length ?? 0).toBeGreaterThan(0);
    expect(workflows.match(/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/g)?.length ?? 0).toBe(
      workflowPaths.length
    );
  });

  it("deploys the playground and rendered Orvi files through GitHub Pages", () => {
    const workflow = read(".github/workflows/deploy-pages.yml");
    const siteBuilder = read("scripts/build-site.mjs");

    expect(workflow).toContain("actions/configure-pages@");
    expect(workflow).toContain("actions/upload-pages-artifact@");
    expect(workflow).toContain("actions/deploy-pages@");
    expect(workflow).toContain("npm run site:build");
    expect(workflow).toContain("deployments: write");
    expect(workflow).toContain("listDeployments");
    expect(workflow).toContain("deleteDeployment");
    expect(siteBuilder).toContain("renderOrvi(source");
    expect(siteBuilder).toContain("renderedOrviFiles");
    expect(siteBuilder).toContain('href="playground/"');
    expect(siteBuilder).toContain('href="../dist/orvi-base.css"');
    expect(siteBuilder).not.toContain('href="/playground/"');
    expect(siteBuilder).not.toContain('href="/rendered/"');
    expect(siteBuilder).not.toContain('href="/dist/orvi-base.css"');
    expect(workflow).toContain("ORVI_PAGES_CNAME");
    expect(siteBuilder).toContain("process.env.ORVI_PAGES_CNAME");
    expect(siteBuilder).toContain('join(siteDir, "CNAME")');
  });

  it("ships VS Code extension distribution without Azure-tied automation", () => {
    expect(() => read(".github/workflows/publish-vscode.yml")).toThrow();

    const packageWorkflow = read(".github/workflows/package-vscode.yml");
    expect(packageWorkflow).toContain("workflow_dispatch");
    expect(packageWorkflow).toContain("npm run package");
    expect(packageWorkflow).toContain("actions/upload-artifact@");
    expect(packageWorkflow).not.toContain("VSCE_PAT");
    expect(packageWorkflow).not.toContain("vsce publish");

    const openVsxWorkflow = read(".github/workflows/publish-open-vsx.yml");
    expect(openVsxWorkflow).toContain("OVSX_PAT");
    expect(openVsxWorkflow).toContain("ovsx publish");
    expect(openVsxWorkflow).not.toContain("VSCE_PAT");
    expect(openVsxWorkflow).not.toContain("azure");

    const rootPackage = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const extensionPackage = JSON.parse(read("vscode/orvi/package.json")) as {
      scripts: Record<string, string>;
    };
    expect(rootPackage.scripts).not.toHaveProperty("vscode:publish");
    expect(extensionPackage.scripts).not.toHaveProperty("publish");
    expect(extensionPackage.scripts.package).toBe("npm run prepare-runtime && vsce package");
  });

  it("wires a pure GitHub release workflow without npm registry publishing or Azure", () => {
    expect(() => read(".github/workflows/publish-npm.yml")).toThrow();

    const workflow = read(".github/workflows/release.yml");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run verify");
    expect(workflow).toContain("ORVI_REQUIRE_BROWSER");
    expect(workflow).toContain("npm pack");
    expect(workflow).toContain("orvi-lang.tgz");
    expect(workflow).toContain("npm run vscode:package");
    expect(workflow).toContain("orvi-language.vsix");
    expect(workflow).toContain("npm run obsidian:build");
    expect(workflow).toContain("versions.json");
    expect(workflow).toContain("obsidian-orvi-plugin.zip");
    expect(workflow).toContain("gh release upload");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("npm publish");
    expect(workflow).not.toContain("registry-url: https://registry.npmjs.org");
    expect(workflow).not.toContain("id-token: write");
    expect(workflow).not.toContain("azure");

    // Tag-driven release: `v*` tags build a GitHub Release asset, the tag must
    // match package.json, and the release notes come from CHANGELOG.md.
    expect(workflow).toMatch(/tags:\s*\n\s*-\s*["']?v\*/);
    expect(workflow).toContain("does not match package.json version");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("scripts/extract-changelog.mjs");
    expect(workflow).toContain("gh release create");

    const rootPackage = JSON.parse(read("package.json")) as {
      name?: string;
      bin?: Record<string, string>;
      private?: boolean;
      publishConfig?: { registry?: string };
      repository?: { url?: string };
      files?: string[];
      scripts?: Record<string, string>;
    };
    expect(rootPackage.name).toBe("orvi-lang");
    expect(rootPackage.private).toBe(true);
    expect(rootPackage.publishConfig?.registry).toBe("https://npm-publish-disabled.invalid");
    expect(rootPackage.scripts?.prepublishOnly).toBe("node scripts/block-npm-publish.mjs");
    expect(read("scripts/block-npm-publish.mjs")).toContain("npm registry publishing is disabled");
    expect(rootPackage.bin).toMatchObject({ orvi: "dist/cli.js" });
    expect(rootPackage.repository?.url).toContain("github.com/jake-w-liu/orvi");
    expect(rootPackage.files).toEqual(expect.arrayContaining(["dist"]));
  });

  it("extracts the release notes for a version from CHANGELOG.md", () => {
    const changelog = read("CHANGELOG.md");
    const version = (JSON.parse(read("package.json")) as { version: string }).version;
    expect(changelog).toContain(`## ${version}`);

    const notes = execFileSync(process.execPath, ["scripts/extract-changelog.mjs", version], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    expect(notes.trim().length).toBeGreaterThan(0);
    expect(notes).not.toContain(`## ${version}`);
  });

  it("hardens CI with a Node matrix, an audit job, an enforced browser smoke, and Dependabot", () => {
    const verify = read(".github/workflows/verify.yml");
    expect(verify).toContain("matrix:");
    expect(verify).toMatch(/node-version:\s*\[20,\s*22,\s*24\]/);
    expect(verify).toContain("npm audit --audit-level=high");
    expect(verify).toContain("ORVI_REQUIRE_BROWSER");

    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toContain("package-ecosystem: github-actions");
    expect(dependabot).toContain("package-ecosystem: npm");
    expect(dependabot).toContain("/vscode/orvi");
  });

  it("commits to Semantic Versioning at 1.0+ with a written stability contract", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    const major = Number(pkg.version.split(".")[0]);
    expect(major).toBeGreaterThanOrEqual(1);

    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("Semantic Versioning");
    expect(changelog).toContain(`## ${pkg.version}`);

    const stability = read("docs/stability.md");
    expect(stability).toContain("Semantic Versioning");
    expect(stability).toContain("Deprecation policy");
    expect(stability).toContain("no plugin or extension API");
    expect(stability).toContain("engines.node");

    expect(read("README.md")).toContain("docs/stability.md");
    expect(read("CONTRIBUTING.md")).toContain("docs/stability.md");
  });

  it("packages the Obsidian plugin as a downloadable bundle (community-store layout)", () => {
    const workflow = read(".github/workflows/package-obsidian.yml");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("npm run obsidian:build");
    expect(workflow).toContain("manifest.json");
    expect(workflow).toContain("main.js");
    expect(workflow).toContain("styles.css");
    expect(workflow).toContain("versions.json");
    expect(workflow).toContain("actions/upload-artifact@");
    expect(workflow).toContain("scripts/set-obsidian-version.mjs");
    expect(workflow).not.toContain("azure");
  });

  it("records the release runbook and the native GitHub rendering decision", () => {
    const releaseRunbook = read("docs/release.md");

    expect(releaseRunbook).toContain("jake-w-liu.orvi-language");
    expect(releaseRunbook).toContain("orvi.dev");
    expect(releaseRunbook).toContain("There is no Azure-backed automation in this repo.");
    expect(releaseRunbook).toContain("github-linguist");
    expect(releaseRunbook).toContain("true native rendering");
    expect(releaseRunbook).toContain(".github/workflows/release.yml");
    expect(releaseRunbook).toContain("npm pack");
    expect(releaseRunbook).toContain("orvi-lang.tgz");
    expect(releaseRunbook).toContain("orvi-language.vsix");
    expect(releaseRunbook).toContain("obsidian-orvi-plugin.zip");
    expect(releaseRunbook).toContain("private: true");
    expect(releaseRunbook).toContain("prepublishOnly");
    expect(releaseRunbook).toContain("publishConfig.registry");
    expect(releaseRunbook).toContain("`NPM_TOKEN` requirement");
  });
});

const workflowPaths = [
  ".github/workflows/deploy-pages.yml",
  ".github/workflows/package-obsidian.yml",
  ".github/workflows/package-vscode.yml",
  ".github/workflows/publish-open-vsx.yml",
  ".github/workflows/release.yml",
  ".github/workflows/verify.yml"
];

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
