import { OrviDiagnostic, DocumentMetadata } from "./ast";
import { renderOrvi, RenderOptions } from "./renderer";

export interface OrviArtifactOptions extends Omit<RenderOptions, "liveReload"> {
  includeSource?: boolean;
  artifactVersion?: "0.1";
}

export interface OrviArtifact {
  type: "application/vnd.orvi.document+json";
  version: "0.1";
  orviVersion?: string;
  metadata: DocumentMetadata;
  source?: string;
  render: {
    html: string;
    fullDocument: boolean;
    colorScheme: "light" | "dark";
  };
  diagnostics: OrviDiagnostic[];
}

export function renderOrviArtifact(source: string, options: OrviArtifactOptions = {}): OrviArtifact {
  const fullDocument = options.fullDocument ?? false;
  const colorScheme = options.colorScheme ?? "light";
  const result = renderOrvi(source, {
    ...options,
    fullDocument,
    colorScheme,
    liveReload: false
  });

  return {
    type: "application/vnd.orvi.document+json",
    version: options.artifactVersion ?? "0.1",
    orviVersion: result.ast.metadata.orvi,
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
