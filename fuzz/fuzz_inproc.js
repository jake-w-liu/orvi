'use strict';
const { renderOrvi } = require('../dist/renderer.js');
const { parseOrvi } = require('../dist/parser.js');
const { formatOrvi } = require('../dist/formatter.js');

const NUL = String.fromCharCode(0);
const pieces = [
  '[grid]', '[/grid]', '[card]', '[/card]', '[callout]', '[/callout]',
  '[tabs]', '[/tabs]', '[tab]', '[/tab]', '---', '\n', '\r\n', '\r',
  '[red]', '[]', '[blue bg=red]', '> ', '- ', '1. ', '# ', '## ',
  '```ts\n', '```', '`', '*', '_', '~~', '|', ':', '//', 'btn: x -> y',
  'img: u | a', 'badge: b | type=info', '[x](http://e)', '[x](javascript:1)',
  '\\', ' ', '\uD800', '\uDC00', NUL, '﻿', '\t', ' ', ' ',
  'http://e.com', '![a](b)', '[ ](c)', '=', '"', "'", '{', '}', '<', '>',
];
function pick(a){return a[Math.floor(Math.random()*a.length)];}
const targets = [
  ['render', s => renderOrvi(s)],
  ['renderFull', s => renderOrvi(s, { fullDocument: true })],
  ['parse', s => parseOrvi(s)],
  ['format', s => formatOrvi(s)],
];
const seen = new Set();
let throws = 0, slow = 0;
for (let i = 0; i < 200000; i++) {
  let s = ''; const n = Math.floor(Math.random()*40)+1;
  for (let j = 0; j < n; j++) s += pick(pieces);
  for (const [name, fn] of targets) {
    const t = Date.now();
    try { fn(s); } catch (e) {
      throws++; const key = name + '|' + e.message;
      if (!seen.has(key)) { seen.add(key); console.log('THROW', name, e.constructor.name, JSON.stringify(e.message.slice(0,80)), 'INPUT', JSON.stringify(s.slice(0,80))); }
    }
    const ms = Date.now() - t;
    if (ms > 500) { slow++; console.log('SLOW', name, ms+'ms', JSON.stringify(s.slice(0,80))); }
  }
}
console.log('done. throws(total)='+throws+' slow='+slow);
