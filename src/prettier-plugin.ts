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
    print: (path: { getValue: () => { source: string } }) => formatOrvi(path.getValue().source).formatted
  }
};
