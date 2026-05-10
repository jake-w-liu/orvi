import * as prettier from "prettier";
import * as luxPlugin from "../src/prettier-plugin";

describe("Prettier Lux plugin", () => {
  it("formats Lux through Prettier parser/printer hooks", async () => {
    const formatted = await prettier.format("[card bg=blue]\n**Hello**\n[/card]", {
      parser: "lux",
      plugins: [luxPlugin]
    });

    expect(formatted).toBe(`[card bg=blue]
  **Hello**
[/card]
`);
  });
});
