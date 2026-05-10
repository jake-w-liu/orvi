import * as React from "react";
import { OrviDiagnostic } from "../../src/ast";
import { OrviRenderer } from "../../src/react";

export const fixtureSource = `---
orvi: 0.1
title: React Fixture
lang: en
---

# React Fixture

[callout type=success]
  Exported React renderer mounted this Orvi document.
[/callout]

[grid 2]
## Metrics

- DOM smoke
- Browser inspection
---
## Status

[green bold] Ready []
[/grid]

btn: Open docs -> https://example.com/orvi`;

export interface ReactOrviFixtureAppProps {
  onDiagnostics?: (diagnostics: OrviDiagnostic[]) => void;
}

export function ReactOrviFixtureApp({ onDiagnostics }: ReactOrviFixtureAppProps): React.ReactElement {
  return React.createElement(
    "main",
    { className: "fixture-shell", "data-fixture": "react-browser" },
    React.createElement(
      "header",
      { className: "fixture-header" },
      React.createElement("p", { className: "fixture-eyebrow" }, "Orvi React fixture"),
      React.createElement("h1", null, "Renderer integration")
    ),
    React.createElement(OrviRenderer, {
      "aria-label": "Rendered Orvi fixture",
      className: "fixture-renderer",
      source: fixtureSource,
      renderOptions: {
        colorScheme: "dark",
        theme: {
          maxWidth: "68ch"
        }
      },
      onDiagnostics
    })
  );
}
