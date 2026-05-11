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
  // A stable per-instance id prefix so multiple <OrviRenderer> on one page do
  // not share `[tabs]` radio-group names.
  const reactId = React.useId();
  const idPrefix = `${reactId.replace(/[^A-Za-z0-9_-]/g, "")}-`;
  const result = React.useMemo(
    () => renderOrvi(source, { ...renderOptions, fullDocument: false, idPrefix }),
    [source, renderOptions, idPrefix]
  );

  React.useEffect(() => {
    onDiagnostics?.(result.ast.diagnostics);
  }, [onDiagnostics, result]);

  return React.createElement("div", {
    ...props,
    className: ["orvi-react-root", className].filter(Boolean).join(" "),
    "data-orvi-diagnostics": result.ast.diagnostics.length,
    dangerouslySetInnerHTML: { __html: result.html }
  });
}

export default OrviRenderer;
