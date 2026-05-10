export interface BenchmarkCorpusFixture {
  name: string;
  orvi: string;
  html: string;
}

interface GeneratedFixtureInput {
  index: number;
  project: string;
  owner: string;
  status: "Stable" | "Beta" | "Pilot" | "Review";
  statusType: "success" | "warning" | "info";
  metric: string;
  region: string;
  asset: string;
  stage: string;
  color: "blue" | "green" | "purple" | "cyan";
}

const generatedInputs: GeneratedFixtureInput[] = [
  ["Atlas", "Ops", "Stable", "success", "Latency", "North", "queue", "Deploy", "blue"],
  ["Aurora", "Data", "Beta", "warning", "Freshness", "South", "map", "Review", "green"],
  ["Beacon", "Core", "Pilot", "info", "Coverage", "East", "trace", "Launch", "purple"],
  ["Cinder", "Risk", "Review", "warning", "Errors", "West", "audit", "Plan", "cyan"],
  ["Delta", "Growth", "Stable", "success", "Revenue", "Central", "funnel", "Deploy", "blue"],
  ["Echo", "Support", "Beta", "warning", "Backlog", "North", "queue", "Review", "green"],
  ["Faro", "Infra", "Pilot", "info", "Capacity", "South", "map", "Launch", "purple"],
  ["Grove", "People", "Review", "warning", "Adoption", "East", "trace", "Plan", "cyan"],
  ["Harbor", "Finance", "Stable", "success", "Margin", "West", "audit", "Deploy", "blue"],
  ["Ion", "Security", "Beta", "warning", "Findings", "Central", "funnel", "Review", "green"],
  ["Juniper", "Ops", "Pilot", "info", "Uptime", "North", "queue", "Launch", "purple"],
  ["Kite", "Data", "Review", "warning", "Quality", "South", "map", "Plan", "cyan"],
  ["Lumen", "Core", "Stable", "success", "Throughput", "East", "trace", "Deploy", "blue"],
  ["Matrix", "Risk", "Beta", "warning", "Exposure", "West", "audit", "Review", "green"],
  ["Nimbus", "Growth", "Pilot", "info", "Pipeline", "Central", "funnel", "Launch", "purple"],
  ["Orbit", "Support", "Review", "warning", "Deflection", "North", "queue", "Plan", "cyan"],
  ["Pulse", "Infra", "Stable", "success", "Utilization", "South", "map", "Deploy", "blue"],
  ["Quartz", "People", "Beta", "warning", "Retention", "East", "trace", "Review", "green"],
  ["River", "Finance", "Pilot", "info", "Forecast", "West", "audit", "Launch", "purple"],
  ["Sierra", "Security", "Review", "warning", "Controls", "Central", "funnel", "Plan", "cyan"],
  ["Tangent", "Ops", "Stable", "success", "Incidents", "North", "queue", "Deploy", "blue"],
  ["Umber", "Data", "Beta", "warning", "Lineage", "South", "map", "Review", "green"],
  ["Vector", "Core", "Pilot", "info", "Requests", "East", "trace", "Launch", "purple"],
  ["Willow", "Risk", "Review", "warning", "Exceptions", "West", "audit", "Plan", "cyan"]
].map(([project, owner, status, statusType, metric, region, asset, stage, color], index) => ({
  index: index + 1,
  project,
  owner,
  status,
  statusType,
  metric,
  region,
  asset,
  stage,
  color
})) as GeneratedFixtureInput[];

export const benchmarkCorpus: BenchmarkCorpusFixture[] = [
  {
    name: "product-brief",
    orvi: `---
orvi: 0.1
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
    html: `<main class="orvi-document">
<h1>Atlas Console</h1>
<p><span class="orvi-text-blue orvi-font-bold"> Ship operational dashboards without hand-writing the surrounding markup. </span></p>
<div class="orvi-grid orvi-grid-2"><div class="orvi-grid-column"><h2>Plan</h2>
<ul class="orvi-list"><li>Audit intake</li><li>Draft workflow</li><li>Launch metrics</li></ul></div><div class="orvi-grid-column"><aside class="orvi-callout orvi-callout-info" role="note" aria-label="Info callout"><p>Review data freshness before publishing.</p></aside></div></div>
<a class="orvi-btn" href="/workspace">Open workspace</a>
</main>`
  },
  {
    name: "release-notes",
    orvi: `# Release 2.4

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
    html: `<main class="orvi-document">
<h1>Release 2.4</h1>
<span class="orvi-badge orvi-badge-success">Stable</span>
<table class="orvi-table"><thead><tr><th>Area</th><th>Change</th><th>Owner</th></tr></thead><tbody><tr><td>Parser</td><td>Keeps table widths strict</td><td>Core</td></tr><tr><td>CLI</td><td>Adds quiet build output</td><td>Tools</td></tr></tbody></table>
<div class="orvi-code-title">config.ts</div>
<pre class="orvi-code"><code class="language-ts">export const retries = 2;
export const timeoutMs = 800;</code></pre>
<aside class="orvi-callout orvi-callout-warning" role="note" aria-label="Warning callout"><p>Validate migrations in staging before promotion.</p></aside>
</main>`
  },
  {
    name: "support-playbook",
    orvi: `# Support Playbook

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
    html: `<main class="orvi-document">
<h1>Support Playbook</h1>
<div class="orvi-tabs" role="tablist" aria-label="Tabs"><input class="orvi-tab-input" type="radio" name="orvi-tabs-0" id="orvi-tabs-0-0" checked><label class="orvi-tab-label" id="orvi-tabs-0-0-tab" role="tab" for="orvi-tabs-0-0" aria-selected="true" aria-controls="orvi-tabs-0-0-panel">Triage</label><div class="orvi-tab-panel" id="orvi-tabs-0-0-panel" role="tabpanel" aria-labelledby="orvi-tabs-0-0-tab"><p><strong>Priority signals</strong></p>
<ul class="orvi-list"><li>Paying account blocked</li><li>Security report</li></ul></div><input class="orvi-tab-input" type="radio" name="orvi-tabs-0" id="orvi-tabs-0-1"><label class="orvi-tab-label" id="orvi-tabs-0-1-tab" role="tab" for="orvi-tabs-0-1" aria-selected="false" aria-controls="orvi-tabs-0-1-panel">Reply</label><div class="orvi-tab-panel" id="orvi-tabs-0-1-panel" role="tabpanel" aria-labelledby="orvi-tabs-0-1-tab"><p><span class="orvi-text-green orvi-font-bold"> Acknowledge, summarize, and name the next checkpoint. </span></p></div></div>
<figure class="orvi-image"><img src="./queue.png" alt="Current support queue"></figure>
<section class="orvi-card orvi-bg-gray"><h2>Escalation</h2>
<p>Email platform-oncall@example.com for production incidents.</p></section>
</main>`
  },
  ...generatedInputs.map(createGeneratedFixture)
];

function createGeneratedFixture(input: GeneratedFixtureInput): BenchmarkCorpusFixture {
  const id = input.index.toString().padStart(2, "0");
  const slug = input.project.toLowerCase();
  const name = `${slug}-operating-review`;
  const codeName = `${slug}Config`;
  const incidentCount = 4 + input.index;
  const score = 70 + (input.index % 19);
  const orvi = `---
orvi: 0.1
title: ${input.project} Operating Review
lang: en-US
---

# ${input.project} Operating Review

badge: ${input.status} | type=${input.statusType}

[${input.color} bold] ${input.owner} keeps the ${input.project} workflow aligned across ${input.region} accounts. []

[grid 3]
  ## Signals
  - ${input.metric} at ${score} percent
  - ${incidentCount} open checkpoints
  - ${input.region} owners assigned
  ---
  [callout type=${input.statusType}]
    Confirm ${input.metric.toLowerCase()} movement before the ${input.stage.toLowerCase()} gate.
  [/callout]
  ---
  \`\`\`ts | ${slug}.ts
  export const ${codeName}Retries = ${2 + (input.index % 4)};
  export const ${codeName}Window = ${15 + input.index};
  \`\`\`
[/grid]

[tabs]
  [tab label=Summary]
    **${input.project} focus:** ${input.metric} and owner coverage.
  [/tab]
  [tab label=Actions]
    1. Review ${input.asset} evidence
    2. Notify ${input.owner} leads
    3. Publish ${input.stage.toLowerCase()} note
  [/tab]
[/tabs]

| Metric | Value | Owner |
| --- | --- | --- |
| ${input.metric} | ${score}% | ${input.owner} |
| Checkpoints | ${incidentCount} | ${input.region} |

img: ./${input.asset}-${id}.png | ${input.project} ${input.asset} evidence

[card bg=gray]
  ## Decision
  Move ${input.project} to ${input.stage.toLowerCase()} when ${input.owner} confirms the latest ${input.metric.toLowerCase()} sample.
[/card]

btn: Open ${input.project} review -> /reviews/${slug}`;

  return {
    name,
    orvi,
    html: createGeneratedHtml(input, id, slug, codeName, incidentCount, score)
  };
}

function createGeneratedHtml(
  input: GeneratedFixtureInput,
  id: string,
  slug: string,
  codeName: string,
  incidentCount: number,
  score: number
): string {
  const calloutLabel = input.statusType.charAt(0).toUpperCase() + input.statusType.slice(1);
  return `<main class="orvi-document">
<h1>${input.project} Operating Review</h1>
<span class="orvi-badge orvi-badge-${input.statusType}">${input.status}</span>
<p><span class="orvi-text-${input.color} orvi-font-bold"> ${input.owner} keeps the ${input.project} workflow aligned across ${input.region} accounts. </span></p>
<div class="orvi-grid orvi-grid-3"><div class="orvi-grid-column"><h2>Signals</h2>
<ul class="orvi-list"><li>${input.metric} at ${score} percent</li><li>${incidentCount} open checkpoints</li><li>${input.region} owners assigned</li></ul></div><div class="orvi-grid-column"><aside class="orvi-callout orvi-callout-${input.statusType}" role="note" aria-label="${calloutLabel} callout"><p>Confirm ${input.metric.toLowerCase()} movement before the ${input.stage.toLowerCase()} gate.</p></aside></div><div class="orvi-grid-column"><div class="orvi-code-title">${slug}.ts</div>
<pre class="orvi-code"><code class="language-ts">  export const ${codeName}Retries = ${2 + (input.index % 4)};
  export const ${codeName}Window = ${15 + input.index};</code></pre></div></div>
<div class="orvi-tabs" role="tablist" aria-label="Tabs"><input class="orvi-tab-input" type="radio" name="orvi-tabs-0" id="orvi-tabs-0-0" checked><label class="orvi-tab-label" id="orvi-tabs-0-0-tab" role="tab" for="orvi-tabs-0-0" aria-selected="true" aria-controls="orvi-tabs-0-0-panel">Summary</label><div class="orvi-tab-panel" id="orvi-tabs-0-0-panel" role="tabpanel" aria-labelledby="orvi-tabs-0-0-tab"><p><strong>${input.project} focus:</strong> ${input.metric} and owner coverage.</p></div><input class="orvi-tab-input" type="radio" name="orvi-tabs-0" id="orvi-tabs-0-1"><label class="orvi-tab-label" id="orvi-tabs-0-1-tab" role="tab" for="orvi-tabs-0-1" aria-selected="false" aria-controls="orvi-tabs-0-1-panel">Actions</label><div class="orvi-tab-panel" id="orvi-tabs-0-1-panel" role="tabpanel" aria-labelledby="orvi-tabs-0-1-tab"><ol class="orvi-list"><li>Review ${input.asset} evidence</li><li>Notify ${input.owner} leads</li><li>Publish ${input.stage.toLowerCase()} note</li></ol></div></div>
<table class="orvi-table"><thead><tr><th>Metric</th><th>Value</th><th>Owner</th></tr></thead><tbody><tr><td>${input.metric}</td><td>${score}%</td><td>${input.owner}</td></tr><tr><td>Checkpoints</td><td>${incidentCount}</td><td>${input.region}</td></tr></tbody></table>
<figure class="orvi-image"><img src="./${input.asset}-${id}.png" alt="${input.project} ${input.asset} evidence"></figure>
<section class="orvi-card orvi-bg-gray"><h2>Decision</h2>
<p>Move ${input.project} to ${input.stage.toLowerCase()} when ${input.owner} confirms the latest ${input.metric.toLowerCase()} sample.</p></section>
<a class="orvi-btn" href="/reviews/${slug}">Open ${input.project} review</a>
</main>`;
}
