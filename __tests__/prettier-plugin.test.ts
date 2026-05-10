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
});
