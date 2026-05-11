import * as React from "react";
import { OrviRenderer } from "../src/react";

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup(element: React.ReactElement): string;
};

describe("OrviRenderer", () => {
  it("returns a React element containing rendered Orvi HTML", () => {
    const element = React.createElement(OrviRenderer, {
      source: "# Hello\n\n[green bold] Done []"
    });
    const html = renderToStaticMarkup(element);

    expect(React.isValidElement(element)).toBe(true);
    expect(html).toContain('class="orvi-react-root"');
    expect(html).toContain('data-orvi-diagnostics="0"');
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("orvi-text-green orvi-font-bold");
  });
});
