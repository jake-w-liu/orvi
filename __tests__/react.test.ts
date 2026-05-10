import * as React from "react";
import { OrviRenderer } from "../src/react";

describe("OrviRenderer", () => {
  it("returns a React element containing rendered Orvi HTML", () => {
    const diagnostics: unknown[] = [];
    const element = OrviRenderer({
      source: "# Hello\n\n[green bold] Done []",
      onDiagnostics: (items) => diagnostics.push(...items)
    });

    expect(React.isValidElement(element)).toBe(true);
    const props = element.props as {
      className: string;
      "data-orvi-diagnostics": number;
      dangerouslySetInnerHTML: { __html: string };
    };
    expect(props.className).toBe("orvi-react-root");
    expect(props["data-orvi-diagnostics"]).toBe(0);
    expect(props.dangerouslySetInnerHTML.__html).toContain("<h1>Hello</h1>");
    expect(props.dangerouslySetInnerHTML.__html).toContain("orvi-text-green orvi-font-bold");
    expect(diagnostics).toEqual([]);
  });
});
