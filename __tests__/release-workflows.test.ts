import { readFileSync } from "fs";
import { join } from "path";

describe("release and deployment workflows", () => {
  it("deploys the playground and rendered Lux files through GitHub Pages", () => {
    const workflow = read(".github/workflows/deploy-pages.yml");
    const siteBuilder = read("scripts/build-site.mjs");

    expect(workflow).toContain("actions/configure-pages@v5");
    expect(workflow).toContain("actions/upload-pages-artifact@v3");
    expect(workflow).toContain("actions/deploy-pages@v4");
    expect(workflow).toContain("npm run site:build");
    expect(siteBuilder).toContain("renderLux(source");
    expect(siteBuilder).toContain("renderedLuxFiles");
    expect(siteBuilder).toContain("lux-lang.dev");
  });

  it("publishes the VS Code extension only through an explicit token-backed workflow", () => {
    const workflow = read(".github/workflows/publish-vscode.yml");
    const extensionPackage = JSON.parse(read("vscode/lux/package.json")) as {
      scripts: Record<string, string>;
    };

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("secrets.VSCE_PAT");
    expect(workflow).toContain("npx vsce publish");
    expect(extensionPackage.scripts.publish).toBe("vsce publish");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
