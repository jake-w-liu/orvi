import * as React from "react";
import { OrviDiagnostic } from "./ast";
import { renderOrvi, RenderOptions } from "./renderer";

export interface OrviRendererProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML"> {
  source: string;
  /**
   * Render options (theme, color scheme, etc.). Primitive fields are compared
   * by value so a new `renderOptions={{ colorScheme: "dark" }}` object each
   * render does not force a re-parse. Stabilize `theme` and `renderNode` with
   * `useMemo` / `useCallback` when they would otherwise be new references every
   * render.
   */
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

  // Pull fields out so a fresh `renderOptions={{ … }}` object each render only
  // re-parses when an actual option value changes (theme / renderNode still
  // compare by reference — callers should memoize those).
  const includeCss = renderOptions?.includeCss;
  const title = renderOptions?.title;
  const fallbackTitle = renderOptions?.fallbackTitle;
  const lang = renderOptions?.lang;
  const dir = renderOptions?.dir;
  const colorScheme = renderOptions?.colorScheme;
  const theme = renderOptions?.theme;
  const extraCss = renderOptions?.extraCss;
  const sourceLocations = renderOptions?.sourceLocations;
  const renderNode = renderOptions?.renderNode;
  const optionsIdPrefix = renderOptions?.idPrefix;

  const result = React.useMemo(
    () =>
      renderOrvi(source, {
        includeCss,
        title,
        fallbackTitle,
        lang,
        dir,
        colorScheme,
        theme,
        extraCss,
        sourceLocations,
        renderNode,
        fullDocument: false,
        idPrefix: optionsIdPrefix ?? idPrefix
      }),
    [
      source,
      includeCss,
      title,
      fallbackTitle,
      lang,
      dir,
      colorScheme,
      theme,
      extraCss,
      sourceLocations,
      renderNode,
      optionsIdPrefix,
      idPrefix
    ]
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
