"use strict";
// Shared, spec-defined vocabularies. Kept in one place so the parser (which
// validates and emits diagnostics) and the renderer (which must never emit an
// unknown value into a class name) can never drift. This module is internal —
// it is not part of the published API surface.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CALLOUT_TYPES = exports.WEIGHT_NAMES = exports.SIZE_NAMES = exports.COLOR_NAMES = exports.SEMANTIC_NAMES = exports.COMPONENT_NAMES = void 0;
exports.COMPONENT_NAMES = new Set(["callout", "grid", "card", "tabs", "tab"]);
exports.SEMANTIC_NAMES = new Set(["btn", "img", "hr", "br", "badge"]);
exports.COLOR_NAMES = new Set([
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
exports.SIZE_NAMES = new Set(["xs", "sm", "md", "lg", "xl", "2xl"]);
exports.WEIGHT_NAMES = new Set(["light", "regular", "medium", "bold"]);
// Shared by `[callout type=…]` and `badge: … | type=…`.
exports.CALLOUT_TYPES = new Set(["info", "warning", "success", "error"]);
