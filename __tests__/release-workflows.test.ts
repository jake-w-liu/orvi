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

  it("ships VS Code extension distribution without Azure-tied automation", () => {
    expect(() => read(".github/workflows/publish-vscode.yml")).toThrow();

    const packageWorkflow = read(".github/workflows/package-vscode.yml");
    expect(packageWorkflow).toContain("workflow_dispatch");
    expect(packageWorkflow).toContain("npm run package");
    expect(packageWorkflow).toContain("actions/upload-artifact@v4");
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

  it("records the release runbook and the native GitHub rendering decision", () => {
    const releaseRunbook = read("docs/release.md");

    expect(releaseRunbook).toContain("jake-w-liu.orvi-language");
    expect(releaseRunbook).toContain("orvi.dev");
    expect(releaseRunbook).toContain("There is no Azure-backed automation in this repo.");
    expect(releaseRunbook).toContain("github-linguist");
    expect(releaseRunbook).toContain(
      "true native rendering",
    );
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
