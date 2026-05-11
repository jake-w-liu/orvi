import { readFileSync } from "fs";
import { join } from "path";

describe("release and deployment workflows", () => {
  it("deploys the playground and rendered Orvi files through GitHub Pages", () => {
    const workflow = read(".github/workflows/deploy-pages.yml");
    const siteBuilder = read("scripts/build-site.mjs");

    expect(workflow).toContain("actions/configure-pages@v6");
    expect(workflow).toContain("actions/upload-pages-artifact@v4");
    expect(workflow).toContain("actions/deploy-pages@v4");
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

  it("keeps automated Marketplace publishing optional and token-backed", () => {
    const workflow = read(".github/workflows/publish-vscode.yml");
    const extensionPackage = JSON.parse(read("vscode/orvi/package.json")) as {
      scripts: Record<string, string>;
    };

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("secrets.VSCE_PAT");
    expect(workflow).toContain("Missing required repository secret: VSCE_PAT");
    expect(workflow).toContain("npx vsce verify-pat jake-w-liu");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("npx vsce publish");
    expect(workflow).toContain("--packagePath orvi-language.vsix");
    const releaseRunbook = read("docs/release.md");
    expect(releaseRunbook).toContain("optional");
    expect(releaseRunbook).toContain("token-backed infrastructure");
    expect(extensionPackage.scripts.publish).toBe("vsce publish");
  });

  it("documents the manual account steps that cannot be completed from repo code", () => {
    const releaseRunbook = read("docs/release.md");

    expect(releaseRunbook).toContain("jake-w-liu.orvi-language");
    expect(releaseRunbook).toContain("VSCE_PAT");
    expect(releaseRunbook).toContain("orvi.dev");
    expect(releaseRunbook).toContain(
      "GitHub does not provide arbitrary repository-native renderers",
    );
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
