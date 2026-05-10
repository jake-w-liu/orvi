import { formatLux } from "./formatter";

export const languages = [
  {
    name: "Lux",
    parsers: ["lux"],
    extensions: [".lux"],
    tmScope: "source.lux",
    aceMode: "text"
  }
];

export const parsers = {
  lux: {
    parse: (text: string) => ({ source: text }),
    astFormat: "lux-ast",
    locStart: () => 0,
    locEnd: (node: { source?: string }) => node.source?.length ?? 0
  }
};

export const printers = {
  "lux-ast": {
    print: (path: { getValue: () => { source: string } }) => formatLux(path.getValue().source).formatted
  }
};
