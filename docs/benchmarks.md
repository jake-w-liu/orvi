# Orvi Benchmark Corpus Results

Measured on 2026-05-11 from the deterministic fixtures in `benchmarks/corpus.ts`.

The corpus is intentionally "large-ish" rather than synthetic at huge scale: 27 valid Orvi documents covering metadata, headings, inline scopes, lists, grids, callouts, cards, tabs, tables, code fences, images, badges, and buttons. Each fixture is rendered through `renderOrvi` in tests and compared with its paired equivalent HTML.

## Summary

| Fixtures | Orvi chars | HTML chars | Char ratio | Orvi bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 27 | 25496 | 58584 | 2.298x | 25496 | 58584 | 2.298x |

## Fixture Measurements

| Fixture | Orvi chars | HTML chars | Char ratio | Orvi bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| product-brief | 348 | 610 | 1.753x | 348 | 610 | 1.753x |
| release-notes | 343 | 686 | 2.000x | 343 | 686 | 2.000x |
| support-playbook | 387 | 1289 | 3.331x | 387 | 1289 | 3.331x |
| atlas-operating-review | 1002 | 2319 | 2.314x | 1002 | 2319 | 2.314x |
| aurora-operating-review | 1020 | 2336 | 2.290x | 1020 | 2336 | 2.290x |
| beacon-operating-review | 1014 | 2327 | 2.295x | 1014 | 2327 | 2.295x |
| cinder-operating-review | 1003 | 2319 | 2.312x | 1003 | 2319 | 2.312x |
| delta-operating-review | 1023 | 2340 | 2.287x | 1023 | 2340 | 2.287x |
| echo-operating-review | 1008 | 2326 | 2.308x | 1008 | 2326 | 2.308x |
| faro-operating-review | 995 | 2310 | 2.322x | 995 | 2310 | 2.322x |
| grove-operating-review | 1012 | 2329 | 2.301x | 1012 | 2329 | 2.301x |
| harbor-operating-review | 1023 | 2339 | 2.286x | 1023 | 2339 | 2.286x |
| ion-operating-review | 1015 | 2334 | 2.300x | 1015 | 2334 | 2.300x |
| juniper-operating-review | 1016 | 2328 | 2.291x | 1016 | 2328 | 2.291x |
| kite-operating-review | 985 | 2303 | 2.338x | 985 | 2303 | 2.338x |
| lumen-operating-review | 1020 | 2337 | 2.291x | 1020 | 2337 | 2.291x |
| matrix-operating-review | 1020 | 2336 | 2.290x | 1020 | 2336 | 2.290x |
| nimbus-operating-review | 1036 | 2349 | 2.267x | 1036 | 2349 | 2.267x |
| orbit-operating-review | 1029 | 2346 | 2.280x | 1029 | 2346 | 2.280x |
| pulse-operating-review | 1026 | 2343 | 2.284x | 1026 | 2343 | 2.284x |
| quartz-operating-review | 1033 | 2349 | 2.274x | 1033 | 2349 | 2.274x |
| river-operating-review | 1017 | 2331 | 2.292x | 1017 | 2331 | 2.292x |
| sierra-operating-review | 1043 | 2359 | 2.262x | 1043 | 2359 | 2.262x |
| tangent-operating-review | 1036 | 2351 | 2.269x | 1036 | 2351 | 2.269x |
| umber-operating-review | 1001 | 2318 | 2.316x | 1001 | 2318 | 2.316x |
| vector-operating-review | 1016 | 2329 | 2.292x | 1016 | 2329 | 2.292x |
| willow-operating-review | 1025 | 2341 | 2.284x | 1025 | 2341 | 2.284x |
