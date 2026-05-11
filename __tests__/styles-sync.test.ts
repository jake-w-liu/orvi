import { readFileSync } from "fs";
import { resolve } from "path";
import { defaultCss } from "../src/styles";

describe("default stylesheet", () => {
  it("inlines exactly the shipped src/orvi-base.css (no drift)", () => {
    const css = readFileSync(resolve(__dirname, "..", "src", "orvi-base.css"), "utf8");
    expect(defaultCss).toBe(css);
  });

  it("declares the auto-generated header so the source of truth is obvious", () => {
    const generated = readFileSync(resolve(__dirname, "..", "src", "styles.ts"), "utf8");
    expect(generated).toMatch(/^\/\/ AUTO-GENERATED FROM src\/orvi-base\.css/);
  });
});
