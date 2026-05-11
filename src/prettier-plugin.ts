import { formatOrvi } from "./formatter";

export const languages = [
  {
    name: "Orvi",
    parsers: ["orvi"],
    extensions: [".ov"],
    tmScope: "source.orvi",
    aceMode: "text"
  }
];

export const parsers = {
  orvi: {
    parse: (text: string) => ({ source: text }),
    astFormat: "orvi-ast",
    locStart: () => 0,
    locEnd: (node: { source?: string }) => node.source?.length ?? 0
  }
};

export const printers = {
  "orvi-ast": {
    print: (path: { getValue: () => { source: string } }): string => {
      const { formatted, diagnostics } = formatOrvi(path.getValue().source);
      const blocking = diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error" || diagnostic.code.startsWith("ORVI_FORMAT_")
      );
      if (blocking.length > 0) {
        const detail = blocking
          .map((diagnostic) => `${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`)
          .join("; ");
        throw new Error(`Orvi cannot be reformatted without losing or guessing content: ${detail}`);
      }
      return formatted;
    }
  }
};
