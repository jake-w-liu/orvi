import { LuxDiagnostic, DocumentMetadata } from "./ast";
import { renderLux, RenderOptions } from "./renderer";

export interface LuxArtifactOptions extends Omit<RenderOptions, "liveReload"> {
  includeSource?: boolean;
  artifactVersion?: "0.1";
}

export interface LuxArtifact {
  type: "application/vnd.lux.document+json";
  version: "0.1";
  luxVersion?: string;
  metadata: DocumentMetadata;
  source?: string;
  render: {
    html: string;
    fullDocument: boolean;
    colorScheme: "light" | "dark";
  };
  diagnostics: LuxDiagnostic[];
}

export function renderLuxArtifact(source: string, options: LuxArtifactOptions = {}): LuxArtifact {
  const fullDocument = options.fullDocument ?? false;
  const colorScheme = options.colorScheme ?? "light";
  const result = renderLux(source, {
    ...options,
    fullDocument,
    colorScheme,
    liveReload: false
  });

  return {
    type: "application/vnd.lux.document+json",
    version: options.artifactVersion ?? "0.1",
    luxVersion: result.ast.metadata.lux,
    metadata: result.ast.metadata,
    ...(options.includeSource === false ? {} : { source }),
    render: {
      html: result.html,
      fullDocument,
      colorScheme
    },
    diagnostics: result.ast.diagnostics
  };
}
