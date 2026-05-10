import * as React from "react";
import { LuxDiagnostic } from "../../src/ast";
import { LuxRenderer } from "../../src/react";

export const fixtureSource = `---
lux: 0.1
title: React Fixture
lang: en
---

# React Fixture

[callout type=success]
  Exported React renderer mounted this Lux document.
[/callout]

[grid 2]
## Metrics

- DOM smoke
- Browser inspection
---
## Status

[green bold] Ready []
[/grid]

btn: Open docs -> https://example.com/lux`;

export interface ReactLuxFixtureAppProps {
  onDiagnostics?: (diagnostics: LuxDiagnostic[]) => void;
}

export function ReactLuxFixtureApp({ onDiagnostics }: ReactLuxFixtureAppProps): React.ReactElement {
  return React.createElement(
    "main",
    { className: "fixture-shell", "data-fixture": "react-browser" },
    React.createElement(
      "header",
      { className: "fixture-header" },
      React.createElement("p", { className: "fixture-eyebrow" }, "Lux React fixture"),
      React.createElement("h1", null, "Renderer integration")
    ),
    React.createElement(LuxRenderer, {
      "aria-label": "Rendered Lux fixture",
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
