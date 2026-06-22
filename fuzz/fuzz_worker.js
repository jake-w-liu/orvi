'use strict';
// Worker: reads a target name + base64 input from argv, runs it, exits.
// Stdin is used for the input to avoid argv length limits.
const { renderOrvi } = require('../dist/renderer.js');
const { parseOrvi } = require('../dist/parser.js');
const { formatOrvi } = require('../dist/formatter.js');

const target = process.argv[2];
const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const input = Buffer.concat(chunks).toString('utf8');
  const fns = {
    render: (s) => renderOrvi(s, { fullDocument: false }),
    renderFull: (s) => renderOrvi(s, { fullDocument: true }),
    parse: (s) => parseOrvi(s),
    format: (s) => formatOrvi(s),
  };
  try {
    const out = fns[target](input);
    // touch output to force materialization
    if (out && out.html) void out.html.length;
    process.exit(0);
  } catch (e) {
    process.stderr.write('ERR:' + ((e && e.message) || String(e)) + '\n');
    process.exit(3);
  }
});
