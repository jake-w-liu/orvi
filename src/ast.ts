export type DiagnosticSeverity = "error" | "warning";

export interface SourceLocation {
  line: number;
  column: number;
}

export interface OrviDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export type TextDirection = "ltr" | "rtl" | "auto";

export interface DocumentMetadata {
  orvi?: string;
  title?: string;
  lang?: string;
  dir?: TextDirection;
}

export interface BaseNode {
  type: string;
  loc: SourceLocation;
}

export interface DocumentNode extends BaseNode {
  type: "document";
  metadata: DocumentMetadata;
  children: BlockNode[];
  diagnostics: OrviDiagnostic[];
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ThematicBreakNode
  | CodeBlockNode
  | TableNode
  | ComponentNode
  | SemanticNode
  | ListNode;

export type InlineNode = TextNode | StrongNode | EmphasisNode | StrikeNode | InlineScopeNode | LinkNode;

export interface TextNode extends BaseNode {
  type: "text";
  value: string;
}

export interface LinkNode extends BaseNode {
  type: "link";
  href: string;
  children: InlineNode[];
}

export interface StrongNode extends BaseNode {
  type: "strong";
  children: InlineNode[];
}

export interface EmphasisNode extends BaseNode {
  type: "emphasis";
  children: InlineNode[];
}

export interface StrikeNode extends BaseNode {
  type: "strike";
  children: InlineNode[];
}

export type InlineModifierKind = "color" | "size" | "weight" | "background";

export interface InlineModifier {
  kind: InlineModifierKind;
  value: string;
}

export interface InlineScopeNode extends BaseNode {
  type: "scope";
  modifiers: InlineModifier[];
  children: InlineNode[];
}

export interface HeadingNode extends BaseNode {
  type: "heading";
  depth: number;
  children: InlineNode[];
}

export interface ParagraphNode extends BaseNode {
  type: "paragraph";
  children: InlineNode[];
}

export interface ThematicBreakNode extends BaseNode {
  type: "thematicBreak";
}

export interface CodeBlockNode extends BaseNode {
  type: "code";
  language?: string;
  filename?: string;
  value: string;
}

export interface TableNode extends BaseNode {
  type: "table";
  headers: InlineNode[][];
  rows: InlineNode[][][];
}

export interface ListNode extends BaseNode {
  type: "list";
  ordered: boolean;
  items: InlineNode[][];
}

export type ComponentName = "callout" | "grid" | "card" | "tabs" | "tab";

export type ComponentOptions = Record<string, string>;

export interface ComponentNode extends BaseNode {
  type: "component";
  name: ComponentName;
  args: string[];
  options: ComponentOptions;
  children: BlockNode[];
  columns?: BlockNode[][];
}

export type SemanticName = "btn" | "img" | "hr" | "br" | "badge";

export interface SemanticNode extends BaseNode {
  type: "semantic";
  name: SemanticName;
  value?: string;
  target?: string;
  alt?: string;
  options: ComponentOptions;
}
