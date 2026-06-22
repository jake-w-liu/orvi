'use strict';
// Find the specific small input that OOMs/hangs. Run each target in an isolated
// worker (low mem cap + timeout) so the culprit is isolated, not the harness.
const { spawnSync } = require('child_process');
const path = require('path');
const WORKER = path.join(__dirname, 'fuzz_worker.js');

const NUL = String.fromCharCode(0);
const pieces = [
  '[grid]', '[/grid]', '[card]', '[/card]', '[callout]', '[/callout]',
  '[tabs]', '[/tabs]', '[tab]', '[/tab]', '---', '\n', '\r\n', '\r',
  '[red]', '[]', '[blue bg=red]', '> ', '- ', '1. ', '# ', '## ',
  '```ts\n', '```', '`', '*', '_', '~~', '|', ':', '//', 'btn: x -> y',
  'img: u | a', 'badge: b | type=info', '[x](http://e)', '[x](javascript:1)',
  '\\', ' ', '\uD800', '\uDC00', NUL, '﻿', '\t', ' ', ' ',
  'http://e.com', '![a](b)', '[ ](c)', '=', '"', "'", '{', '}', '<', '>',
];
function pick(a){return a[Math.floor(Math.random()*a.length)];}
const TARGETS = ['render','renderFull','parse','format'];
const MEM = 1024;

let found = 0;
for (let i = 0; i < 40000 && found < 8; i++) {
  let s = ''; const n = Math.floor(Math.random()*40)+1;
  for (let j = 0; j < n; j++) s += pick(pieces);
  for (const t of TARGETS) {
    const r = spawnSync('node', ['--max-old-space-size='+MEM, WORKER, t], {
      input: Buffer.from(s,'utf8'), timeout: 2500, maxBuffer: 1<<26,
    });
    let bad = null;
    if (r.error && r.error.code === 'ETIMEDOUT') bad = 'TIMEOUT';
    else if (r.status === null && r.signal) bad = 'CRASH/OOM:' + r.signal;
    else if (r.status !== 0 && r.status !== 3) bad = 'EXIT:'+r.status;
    // status 3 = caught throw; report those too but separately
    else if (r.status === 3) bad = 'THROW:' + (r.stderr||'').toString().trim().slice(0,80);
    if (bad) {
      found++;
      console.log(bad, '| target='+t, '| len='+s.length, '| input='+JSON.stringify(s));
    }
  }
}
console.log('scan done, found='+found);
