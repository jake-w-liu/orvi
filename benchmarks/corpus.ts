export interface BenchmarkCorpusFixture {
  name: string;
  lux: string;
  html: string;
}

export const benchmarkCorpus: BenchmarkCorpusFixture[] = [
  {
    name: "product-brief",
    lux: `---
lux: 0.1
title: Atlas Console
---

# Atlas Console

[blue bold] Ship operational dashboards without hand-writing the surrounding markup. []

[grid 2]
  ## Plan
  - Audit intake
  - Draft workflow
  - Launch metrics
  ---
  [callout type=info]
    Review data freshness before publishing.
  [/callout]
[/grid]

btn: Open workspace -> /workspace`,
    html: `<main class="lux-document">
<h1>Atlas Console</h1>
<p><span class="lux-text-blue lux-font-bold"> Ship operational dashboards without hand-writing the surrounding markup. </span></p>
<div class="lux-grid lux-grid-2"><div class="lux-grid-column"><h2>Plan</h2>
<ul class="lux-list"><li>Audit intake</li><li>Draft workflow</li><li>Launch metrics</li></ul></div><div class="lux-grid-column"><aside class="lux-callout lux-callout-info" role="note" aria-label="Info callout"><p>Review data freshness before publishing.</p></aside></div></div>
<a class="lux-btn" href="/workspace">Open workspace</a>
</main>`
  },
  {
    name: "release-notes",
    lux: `# Release 2.4

badge: Stable | type=success

| Area | Change | Owner |
| --- | --- | --- |
| Parser | Keeps table widths strict | Core |
| CLI | Adds quiet build output | Tools |

\`\`\`ts | config.ts
export const retries = 2;
export const timeoutMs = 800;
\`\`\`

[callout type=warning]
  Validate migrations in staging before promotion.
[/callout]`,
    html: `<main class="lux-document">
<h1>Release 2.4</h1>
<span class="lux-badge lux-badge-success">Stable</span>
<table class="lux-table"><thead><tr><th>Area</th><th>Change</th><th>Owner</th></tr></thead><tbody><tr><td>Parser</td><td>Keeps table widths strict</td><td>Core</td></tr><tr><td>CLI</td><td>Adds quiet build output</td><td>Tools</td></tr></tbody></table>
<div class="lux-code-title">config.ts</div>
<pre class="lux-code"><code class="language-ts">export const retries = 2;
export const timeoutMs = 800;</code></pre>
<aside class="lux-callout lux-callout-warning" role="note" aria-label="Warning callout"><p>Validate migrations in staging before promotion.</p></aside>
</main>`
  },
  {
    name: "support-playbook",
    lux: `# Support Playbook

[tabs]
  [tab label=Triage]
    **Priority signals**
    - Paying account blocked
    - Security report
  [/tab]
  [tab label=Reply]
    [green bold] Acknowledge, summarize, and name the next checkpoint. []
  [/tab]
[/tabs]

img: ./queue.png | Current support queue

[card bg=gray]
  ## Escalation
  Email platform-oncall@example.com for production incidents.
[/card]`,
    html: `<main class="lux-document">
<h1>Support Playbook</h1>
<div class="lux-tabs" role="tablist" aria-label="Tabs"><input class="lux-tab-input" type="radio" name="lux-tabs-0" id="lux-tabs-0-0" checked><label class="lux-tab-label" id="lux-tabs-0-0-tab" role="tab" for="lux-tabs-0-0" aria-selected="true" aria-controls="lux-tabs-0-0-panel">Triage</label><div class="lux-tab-panel" id="lux-tabs-0-0-panel" role="tabpanel" aria-labelledby="lux-tabs-0-0-tab"><p><strong>Priority signals</strong></p>
<ul class="lux-list"><li>Paying account blocked</li><li>Security report</li></ul></div><input class="lux-tab-input" type="radio" name="lux-tabs-0" id="lux-tabs-0-1"><label class="lux-tab-label" id="lux-tabs-0-1-tab" role="tab" for="lux-tabs-0-1" aria-selected="false" aria-controls="lux-tabs-0-1-panel">Reply</label><div class="lux-tab-panel" id="lux-tabs-0-1-panel" role="tabpanel" aria-labelledby="lux-tabs-0-1-tab"><p><span class="lux-text-green lux-font-bold"> Acknowledge, summarize, and name the next checkpoint. </span></p></div></div>
<figure class="lux-image"><img src="./queue.png" alt="Current support queue"></figure>
<section class="lux-card lux-bg-gray"><h2>Escalation</h2>
<p>Email platform-oncall@example.com for production incidents.</p></section>
</main>`
  }
];
