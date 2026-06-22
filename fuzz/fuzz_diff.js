'use strict';
const { renderOrvi } = require('../dist/renderer.js');
const { parseOrvi } = require('../dist/parser.js');
const { formatOrvi } = require('../dist/formatter.js');

const pieces = [
  '[grid 2]', '[/grid]', '[card]', '[/card]', '[callout type=info]', '[/callout]',
  '[tabs]', '[/tabs]', '[tab label=a]', '[/tab]', '---', '\n',
  '[red]', '[]', '[blue bg=red]', '> ', '- ', '1. ', '# ', '## ',
  '```ts\n', '```', '`', '*', '**', '_', '~~', '|', ':', '//', 'btn: x -> y',
  'img: u | a', 'badge: b | type=info', '[x](http://e)', 'a', 'b ', ' ',
  'http://e.com', '[ ](c)', '=', 'x', '.', '\\', '- [x] t', '- [ ] t', '\t',
  '| h | g |', '| --- | --- |', '| 1 | 2 |', '<', '>', '"', "'", '![a](b)',
];
function rand(n){return Math.floor(Math.random()*n);}
function pick(a){return a[rand(a.length)];}
function gen(maxLen){let s='';const n=rand(maxLen)+1;for(let i=0;i<n;i++)s+=pick(pieces);return s;}

const findings=[];
function add(kind, src, extra){ findings.push({kind, src, ...extra}); }

let N=300000;
for(let i=0;i<N;i++){
  const src = gen(14);
  let f1;
  try { f1 = formatOrvi(src); } catch(e){ add('format-throw', src, {err:e.message}); continue; }
  let renderSrc, renderFmt, f2;
  try { renderSrc = renderOrvi(src).html; } catch(e){ add('render-src-throw', src, {err:e.message}); continue; }
  try { renderFmt = renderOrvi(f1.formatted).html; } catch(e){ add('render-fmt-throw', src, {err:e.message, fmt:f1.formatted}); continue; }
  try { f2 = formatOrvi(f1.formatted); } catch(e){ add('format2-throw', src, {err:e.message, fmt:f1.formatted}); continue; }

  const clean = f1.diagnostics.filter(d=>String(d.code).startsWith('ORVI_FORMAT_')).length===0;
  // Round-trip semantic equivalence: only assert when formatter claims no loss.
  if (clean && renderSrc !== renderFmt) {
    add('roundtrip-mismatch', src, {fmt:f1.formatted, renderSrc, renderFmt});
  }
  // Idempotency: format(format(x)) === format(x)
  if (f2.formatted !== f1.formatted) {
    add('not-idempotent', src, {fmt:f1.formatted, fmt2:f2.formatted});
  }
}

// dedupe
const seen=new Map();
for(const f of findings){
  const key=f.kind+'|'+(f.err||'');
  if(!seen.has(key)) seen.set(key,[]);
  if(seen.get(key).length<3) seen.get(key).push(f);
}
console.log('total findings:', findings.length);
for(const [k,arr] of seen){
  console.log('\n==== '+k+' (x'+findings.filter(f=>f.kind+'|'+(f.err||'')===k).length+') ====');
  for(const f of arr){
    console.log('SRC ', JSON.stringify(f.src));
    if(f.fmt!==undefined) console.log('FMT ', JSON.stringify(f.fmt));
    if(f.fmt2!==undefined) console.log('FMT2', JSON.stringify(f.fmt2));
    if(f.renderSrc!==undefined) console.log('RS  ', JSON.stringify(f.renderSrc));
    if(f.renderFmt!==undefined) console.log('RF  ', JSON.stringify(f.renderFmt));
    if(f.err) console.log('ERR ', f.err);
    console.log('--');
  }
}
