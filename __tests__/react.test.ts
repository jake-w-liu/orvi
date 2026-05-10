import * as React from "react";
import { LuxRenderer } from "../src/react";

describe("LuxRenderer", () => {
  it("returns a React element containing rendered Lux HTML", () => {
    const diagnostics: unknown[] = [];
    const element = LuxRenderer({
      source: "# Hello\n\n[green bold] Done []",
      onDiagnostics: (items) => diagnostics.push(...items)
    });

    expect(React.isValidElement(element)).toBe(true);
    const props = element.props as {
      className: string;
      "data-lux-diagnostics": number;
      dangerouslySetInnerHTML: { __html: string };
    };
    expect(props.className).toBe("lux-react-root");
    expect(props["data-lux-diagnostics"]).toBe(0);
    expect(props.dangerouslySetInnerHTML.__html).toContain("<h1>Hello</h1>");
    expect(props.dangerouslySetInnerHTML.__html).toContain("lux-text-green lux-font-bold");
    expect(diagnostics).toEqual([]);
  });
});
