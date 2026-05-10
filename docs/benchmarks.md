# Lux Benchmark Corpus Results

Measured on 2026-05-11 from the deterministic fixtures in `benchmarks/corpus.ts`.

The corpus is intentionally "large-ish" rather than synthetic at huge scale: 27 valid Lux documents covering metadata, headings, inline scopes, lists, grids, callouts, cards, tabs, tables, code fences, images, badges, and buttons. Each fixture is rendered through `renderLux` in tests and compared with its paired equivalent HTML.

## Summary

| Fixtures | Lux chars | HTML chars | Char ratio | Lux bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 27 | 25471 | 57529 | 2.259x | 25471 | 57529 | 2.259x |

## Fixture Measurements

| Fixture | Lux chars | HTML chars | Char ratio | Lux bytes | HTML bytes | Byte ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| product-brief | 347 | 599 | 1.726x | 347 | 599 | 1.726x |
| release-notes | 343 | 678 | 1.977x | 343 | 678 | 1.977x |
| support-playbook | 387 | 1261 | 3.258x | 387 | 1261 | 3.258x |
| atlas-operating-review | 1001 | 2277 | 2.275x | 1001 | 2277 | 2.275x |
| aurora-operating-review | 1019 | 2294 | 2.251x | 1019 | 2294 | 2.251x |
| beacon-operating-review | 1013 | 2285 | 2.256x | 1013 | 2285 | 2.256x |
| cinder-operating-review | 1002 | 2277 | 2.272x | 1002 | 2277 | 2.272x |
| delta-operating-review | 1022 | 2298 | 2.249x | 1022 | 2298 | 2.249x |
| echo-operating-review | 1007 | 2284 | 2.268x | 1007 | 2284 | 2.268x |
| flux-operating-review | 994 | 2268 | 2.282x | 994 | 2268 | 2.282x |
| grove-operating-review | 1011 | 2287 | 2.262x | 1011 | 2287 | 2.262x |
| harbor-operating-review | 1022 | 2297 | 2.248x | 1022 | 2297 | 2.248x |
| ion-operating-review | 1014 | 2292 | 2.260x | 1014 | 2292 | 2.260x |
| juniper-operating-review | 1015 | 2286 | 2.252x | 1015 | 2286 | 2.252x |
| kite-operating-review | 984 | 2261 | 2.298x | 984 | 2261 | 2.298x |
| lumen-operating-review | 1019 | 2295 | 2.252x | 1019 | 2295 | 2.252x |
| matrix-operating-review | 1019 | 2294 | 2.251x | 1019 | 2294 | 2.251x |
| nimbus-operating-review | 1035 | 2307 | 2.229x | 1035 | 2307 | 2.229x |
| orbit-operating-review | 1028 | 2304 | 2.241x | 1028 | 2304 | 2.241x |
| pulse-operating-review | 1025 | 2301 | 2.245x | 1025 | 2301 | 2.245x |
| quartz-operating-review | 1032 | 2307 | 2.235x | 1032 | 2307 | 2.235x |
| river-operating-review | 1016 | 2289 | 2.253x | 1016 | 2289 | 2.253x |
| sierra-operating-review | 1042 | 2317 | 2.224x | 1042 | 2317 | 2.224x |
| tangent-operating-review | 1035 | 2309 | 2.231x | 1035 | 2309 | 2.231x |
| umber-operating-review | 1000 | 2276 | 2.276x | 1000 | 2276 | 2.276x |
| vector-operating-review | 1015 | 2287 | 2.253x | 1015 | 2287 | 2.253x |
| willow-operating-review | 1024 | 2299 | 2.245x | 1024 | 2299 | 2.245x |
