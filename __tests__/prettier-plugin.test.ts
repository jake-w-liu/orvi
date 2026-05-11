import * as prettier from "prettier";
import * as orviPlugin from "../src/prettier-plugin";

describe("Prettier Orvi plugin", () => {
  it("formats Orvi through Prettier parser/printer hooks", async () => {
    const formatted = await prettier.format("[card bg=blue]\n**Hello**\n[/card]", {
      parser: "orvi",
      plugins: [orviPlugin]
    });

    expect(formatted).toBe(`[card bg=blue]
  **Hello**
[/card]
`);
  });

  it("refuses to print when content would be lost or guessed", () => {
    const print = orviPlugin.printers["orvi-ast"].print;
    const printSource = (source: string) => print({ getValue: () => ({ source }) });

    expect(() => printSource("// keep this note\n# Title\n")).toThrow(/ORVI_FORMAT_COMMENT_DROPPED/);
    expect(() => printSource("---\norvi: 0.1\nfuturekey: keep me\n---\n# Title\n")).toThrow(
      /ORVI_FORMAT_METADATA_DROPPED/
    );
    expect(() => printSource("[chart]\nbad\n[/chart]\n")).toThrow(/ORVI_UNKNOWN_COMPONENT/);
  });
});
