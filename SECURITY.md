# Security Policy

## Scope

Orvi compiles human/AI-written `.ov` markup into HTML. The most relevant
security property is therefore: **rendering an untrusted Orvi document must not
produce HTML that executes script or otherwise escapes its container.**

What the renderer guarantees in v0.1:

- All text and attribute values are HTML-escaped (`renderToHtml` in
  `src/renderer.ts`).
- URL-bearing values (`btn:` targets, `img:` sources) pass through `safeUrl`,
  which allows `http`, `https`, `mailto`, `tel`, fragment, query, and relative
  URLs, and neutralizes everything else (`javascript:`, `data:`, `vbscript:`,
  protocol-relative `//host`, control characters) to `#`.
- `<style>` content is `</style>`-neutralized; theme/config CSS values reject
  control characters, `;{}<>`, and comment markers.
- Orvi has no `<script>`/event-handler/dynamic-expression surface. `{name}`
  style expressions are rejected with a diagnostic outside fenced code blocks.

Embedders are still responsible for the surrounding page (CSP, framing, where
the rendered HTML is inserted). The `OrviRenderer` React component injects via
`dangerouslySetInnerHTML` on purpose — the safety comes from the renderer's
escaping, not from React.

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security
Advisories on the repository (`Security` → `Report a vulnerability`). If that is
unavailable, open a minimal issue asking for a private channel — do not post a
working exploit publicly first.

Helpful details: the smallest `.ov` input that reproduces the issue, the
rendered HTML it produces, and which surface (`renderOrvi`, the CLI, the React
component, the VS Code preview, the playground).
