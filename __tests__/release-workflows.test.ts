import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("release and deployment workflows", () => {
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

  it("wires a token-gated npm publish workflow without Azure", () => {
    const workflow = read(".github/workflows/publish-npm.yml");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("registry-url: https://registry.npmjs.org");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run verify");
    expect(workflow).toContain("secrets.NPM_TOKEN");
    expect(workflow).toContain("Missing required repository secret: NPM_TOKEN");
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain("npm publish --provenance --access public");
    expect(workflow).toContain("id-token: write");
    expect(workflow).not.toContain("azure");

    // Tag-driven release: `v*` tags publish, the tag must match package.json,
    // and a GitHub Release is cut with the matching CHANGELOG.md section.
    expect(workflow).toMatch(/tags:\s*\n\s*-\s*["']?v\*/);
    expect(workflow).toContain("does not match package.json version");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("scripts/extract-changelog.mjs");
    expect(workflow).toContain("gh release create");

    const rootPackage = JSON.parse(read("package.json")) as {
      name?: string;
      bin?: Record<string, string>;
      repository?: { url?: string };
      files?: string[];
    };
    expect(rootPackage.name).toBe("orvi-lang");
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

  it("hardens CI with a Node matrix, an audit job, and Dependabot", () => {
    const verify = read(".github/workflows/verify.yml");
    expect(verify).toContain("matrix:");
    expect(verify).toMatch(/node-version:\s*\[20,\s*22,\s*24\]/);
    expect(verify).toContain("npm audit --audit-level=high");

    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toContain("package-ecosystem: github-actions");
    expect(dependabot).toContain("package-ecosystem: npm");
    expect(dependabot).toContain("/vscode/orvi");
  });

  it("packages the Obsidian plugin as a downloadable bundle (community-store layout)", () => {
    const workflow = read(".github/workflows/package-obsidian.yml");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("npm run obsidian:build");
    expect(workflow).toContain("manifest.json");
    expect(workflow).toContain("main.js");
    expect(workflow).toContain("styles.css");
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
    expect(releaseRunbook).toContain(".github/workflows/publish-npm.yml");
    expect(releaseRunbook).toContain("NPM_TOKEN");
    expect(releaseRunbook).toContain("npm publish --provenance --access public");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
