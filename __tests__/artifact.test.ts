import { readFileSync } from "fs";
import { join } from "path";
import { renderOrviArtifact } from "../src/artifact";

describe("renderOrviArtifact", () => {
  it("creates a stable Orvi artifact with rendered HTML and metadata", () => {
    const artifact = renderOrviArtifact(
      `---
orvi: 0.1
title: Artifact Fixture
lang: en
---

# Artifact Fixture

[callout type=success]
  Rendered as a portable artifact.
[/callout]`,
      { fullDocument: true, colorScheme: "dark" }
    );

    expect(artifact.type).toBe("application/vnd.orvi.document+json");
    expect(artifact.version).toBe("0.1");
    expect(artifact.orviVersion).toBe("0.1");
    expect(artifact.metadata).toEqual({ orvi: "0.1", title: "Artifact Fixture", lang: "en" });
    expect(artifact.render.fullDocument).toBe(true);
    expect(artifact.render.colorScheme).toBe("dark");
    expect(artifact.render.html).toContain("<title>Artifact Fixture</title>");
    expect(artifact.render.html).toContain("Rendered as a portable artifact.");
    expect(artifact.source).toContain("# Artifact Fixture");
    expect(artifact.diagnostics).toEqual([]);
  });

  it("can omit source for render surfaces that should not echo prompts", () => {
    const artifact = renderOrviArtifact("# Private", { includeSource: false });

    expect(artifact.source).toBeUndefined();
    expect(artifact.render.html).toContain("<h1>Private</h1>");
  });

  it("ships a JSON schema for artifact consumers", () => {
    const schemaPath = join(process.cwd(), "schemas", "orvi-artifact.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.required).toEqual(["type", "version", "metadata", "render", "diagnostics"]);
    expect(schema.properties).toHaveProperty("render");
    expect(schema.properties).toHaveProperty("diagnostics");
  });
});
