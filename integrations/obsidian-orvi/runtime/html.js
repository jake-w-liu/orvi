"use strict";
/** Shared HTML escaping for the renderer and CLI diagnostic panel. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.escapeAttr = escapeAttr;
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
}
