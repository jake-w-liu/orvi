console.error(
  [
    "npm registry publishing is disabled for this repository.",
    "Use the GitHub Release workflow, which builds npm-compatible tarballs with npm pack."
  ].join(" ")
);
process.exit(1);
