import { readFileSync } from "fs";
import { join } from "path";
import { renderLuxArtifact } from "../src/artifact";

describe("renderLuxArtifact", () => {
  it("creates a stable Lux artifact with rendered HTML and metadata", () => {
    const artifact = renderLuxArtifact(
      `---
lux: 0.1
title: Artifact Fixture
lang: en
---

# Artifact Fixture

[callout type=success]
  Rendered as a portable artifact.
[/callout]`,
      { fullDocument: true, colorScheme: "dark" }
    );

    expect(artifact.type).toBe("application/vnd.lux.document+json");
    expect(artifact.version).toBe("0.1");
    expect(artifact.luxVersion).toBe("0.1");
    expect(artifact.metadata).toEqual({ lux: "0.1", title: "Artifact Fixture", lang: "en" });
    expect(artifact.render.fullDocument).toBe(true);
    expect(artifact.render.colorScheme).toBe("dark");
    expect(artifact.render.html).toContain("<title>Artifact Fixture</title>");
    expect(artifact.render.html).toContain("Rendered as a portable artifact.");
    expect(artifact.source).toContain("# Artifact Fixture");
    expect(artifact.diagnostics).toEqual([]);
  });

  it("can omit source for render surfaces that should not echo prompts", () => {
    const artifact = renderLuxArtifact("# Private", { includeSource: false });

    expect(artifact.source).toBeUndefined();
    expect(artifact.render.html).toContain("<h1>Private</h1>");
  });

  it("ships a JSON schema for artifact consumers", () => {
    const schemaPath = join(process.cwd(), "schemas", "lux-artifact.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.required).toEqual(["type", "version", "metadata", "render", "diagnostics"]);
    expect(schema.properties).toHaveProperty("render");
    expect(schema.properties).toHaveProperty("diagnostics");
  });
});
