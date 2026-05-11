import * as React from "react";
import { OrviDiagnostic } from "./ast";
import { renderOrvi, RenderOptions } from "./renderer";

export interface OrviRendererProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML"> {
  source: string;
  renderOptions?: Omit<RenderOptions, "fullDocument" | "liveReload">;
  onDiagnostics?: (diagnostics: OrviDiagnostic[]) => void;
}

export function OrviRenderer({
  source,
  renderOptions,
  onDiagnostics,
  className,
  ...props
}: OrviRendererProps): React.ReactElement {
  const result = renderOrvi(source, {
    ...renderOptions,
    fullDocument: false
  });

  React.useEffect(() => {
    onDiagnostics?.(result.ast.diagnostics);
  }, [onDiagnostics, result.ast.diagnostics]);

  return React.createElement("div", {
    ...props,
    className: ["orvi-react-root", className].filter(Boolean).join(" "),
    "data-orvi-diagnostics": result.ast.diagnostics.length,
    dangerouslySetInnerHTML: { __html: result.html }
  });
}

export default OrviRenderer;
