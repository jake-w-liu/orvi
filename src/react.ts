import * as React from "react";
import { LuxDiagnostic } from "./ast";
import { renderLux, RenderOptions } from "./renderer";

export interface LuxRendererProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML"> {
  source: string;
  renderOptions?: Omit<RenderOptions, "fullDocument" | "liveReload">;
  onDiagnostics?: (diagnostics: LuxDiagnostic[]) => void;
}

export function LuxRenderer({
  source,
  renderOptions,
  onDiagnostics,
  className,
  ...props
}: LuxRendererProps): React.ReactElement {
  const result = renderLux(source, {
    ...renderOptions,
    fullDocument: false
  });

  if (onDiagnostics) {
    onDiagnostics(result.ast.diagnostics);
  }

  return React.createElement("div", {
    ...props,
    className: ["lux-react-root", className].filter(Boolean).join(" "),
    "data-lux-diagnostics": result.ast.diagnostics.length,
    dangerouslySetInnerHTML: { __html: result.html }
  });
}

export default LuxRenderer;
