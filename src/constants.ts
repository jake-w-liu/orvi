// Shared, spec-defined vocabularies. Kept in one place so the parser (which
// validates and emits diagnostics) and the renderer (which must never emit an
// unknown value into a class name) can never drift. This module is internal —
// it is not part of the published API surface.

export const COMPONENT_NAMES = new Set(["callout", "grid", "card", "tabs", "tab"]);

export const SEMANTIC_NAMES = new Set(["btn", "img", "hr", "br", "badge"]);

export const COLOR_NAMES = new Set([
  "red",
  "blue",
  "green",
  "gray",
  "muted",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan",
  "white",
  "black"
]);

export const SIZE_NAMES = new Set(["xs", "sm", "md", "lg", "xl", "2xl"]);

export const WEIGHT_NAMES = new Set(["light", "regular", "medium", "bold"]);

// Shared by `[callout type=…]` and `badge: … | type=…`.
export const CALLOUT_TYPES = new Set(["info", "warning", "success", "error"]);
