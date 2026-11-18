#!/usr/bin/env node
/**
 * Dependency audit with a SCOPED allowlist of known, accepted advisories.
 *
 * The point is to keep the audit an enforced gate: it fails on every advisory except the exact ones listed below,
 * by GHSA id. It is not a severity downgrade and it is not a blanket skip.
 *
 * Add an entry only when there is no upstream fix available, the risk has been assessed, and a tracking issue
 * exists. Every entry must carry the issue URL so it can be re-checked and removed.
 */
import { spawnSync } from 'node:child_process';

/** Known advisories we accept for now: no fixed release exists upstream. */
const ACCEPTED = new Map([
  [
    'GHSA-fc5q-39xc-vjpf',
    {
      package: 'picomatch',
      issue: 'https://github.com/aprraju/myvedicstar-ui/issues/95',
      // Full assessment, exposure analysis and revisit date: docs/security/accepted-dependency-advisories.md
      reason:
        'picomatch ReDoS (CWE-1333, CVSS 7.5): slow regex compilation on adversarial brace/glob input. Transitive and build-time only (knip -> fdir/tinyglobby/picomatch, vite, vitest, jest via micromatch under apps/mobile, @expo/cli). Absent from the web runtime tree entirely (npm ls --workspace=@myvedicstar/web --omit=dev lists no picomatch), so no attacker-controlled input reaches it in production. Advisory range is <=4.0.7 and 4.0.7 IS the latest published version (npm view picomatch version), so no fixed release exists. Already covered by exact-pinned versions and a committed lockfile: nothing can drift onto a different range without a reviewed lockfile change. Revisit 2027-02-18.',
    },
  ],
]);

const args = ['audit', '--omit=dev', '--audit-level=high', '--workspace=@myvedicstar/web', '--json'];
const result = spawnSync('npm', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  // A non-JSON failure means npm itself broke: fail loudly rather than assume clean.
  console.error('Dependency audit produced no parseable report; failing.');
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(1);
}

/** Collect every advisory id in the report, grouped by the package that pulled it in. */
const found = [];
for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of entry.via ?? []) {
    if (typeof via === 'string') continue; // a name-only link; the concrete advisory appears elsewhere
    const match = /GHSA-[a-z0-9-]+/i.exec(via.url ?? '');
    found.push({ id: match ? match[0] : '(unknown)', package: name, severity: via.severity, url: via.url });
  }
}

const unique = [...new Map(found.map((item) => [`${item.id}|${item.package}`, item])).values()];
const accepted = unique.filter((item) => ACCEPTED.has(item.id));
const blocking = unique.filter((item) => !ACCEPTED.has(item.id));

for (const item of accepted) {
  const meta = ACCEPTED.get(item.id);
  console.log(`ACCEPTED ${item.id} (${item.package}, ${item.severity}) -> ${meta.issue}`);
  console.log(`  reason: ${meta.reason}`);
}

if (blocking.length > 0) {
  console.error('');
  console.error(`Dependency audit failed: ${blocking.length} advisory(ies) are not in the accepted list.`);
  for (const item of blocking) {
    console.error(`  ${item.severity?.toUpperCase() ?? '?'} ${item.id} in ${item.package} ${item.url ?? ''}`);
  }
  console.error('Fix, or add a scoped entry with a tracking issue if no fix exists upstream.');
  process.exit(1);
}

// Belt and braces. npm lists an advisory once against the package that carries it, and marks every package it
// taints as 'via' that package's name. So the meaningful count is distinct advisory ids: if the report contains
// any id we did not explicitly accept, 'blocking' is non-empty and we have already exited above. What can still go
// wrong is an advisory whose url carries no GHSA id, which would silently never match an entry - so refuse those.
const unknownIds = unique.filter((item) => item.id === '(unknown)');
if (unknownIds.length > 0) {
  console.error('Dependency audit failed: an advisory had no GHSA id, so it cannot be matched or accepted.');
  for (const item of unknownIds) console.error(`  ${item.package} ${item.url ?? ''}`);
  process.exit(1);
}

console.log(`Dependency audit passed: no unaccepted advisories (${accepted.length} accepted, tracked).`);
