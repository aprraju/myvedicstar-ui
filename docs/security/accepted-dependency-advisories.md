# Accepted dependency advisories

The `Dependency audit` step on web verify (`npm run web:audit`) is a gate, not a report: it fails on every advisory
except the exact GHSA ids listed in `infrastructure/web/static-web-apps/scripts/audit-with-exceptions.mjs`. An entry
there is only legitimate when there is no upstream fix, the exposure has been assessed, and the decision expires.

This document records that assessment. The script is the enforcement; this file is the reasoning and the revisit date.

## Process for adding an entry

1. Confirm there is genuinely no fixed release upstream (check the advisory's vulnerable range against the latest
   published version of the package, not against the version we happen to have installed).
2. Establish whether the vulnerable package is reachable at all from shipped code, separately for the web runtime tree
   (`npm ls --workspace=@myvedicstar/web --omit=dev`), the mobile runtime tree, and build/test tooling only.
3. Write the reasoning into the script entry as a one-paragraph `reason`, ending with the revisit date, and add a
   matching section below.
4. Record a revisit date no more than six months out. When it arrives, re-check for an upstream release; if one exists,
   upgrade and delete both the entry and this section. Do not extend a revisit date without also re-running step 2.

A new advisory does **not** get accepted by adding a line; it gets accepted by this process.

## GHSA-fc5q-39xc-vjpf — picomatch ReDoS

- **Status:** accepted, tracked by [#95](https://github.com/aprraju/myvedicstar-ui/issues/95).
- **Accepted on:** 2026-11-18.
- **Revisit by:** 2027-02-18.

### What the advisory is

A regular-expression denial of service (CWE-1333, CVSS 7.5) in `picomatch`, the glob-to-regex compiler used widely by
build tooling. Crafted brace/glob expressions cause the parser to compile a pathological regex, and matching against
that regex then consumes superlinear time. The impact is CPU starvation of whichever process performed the match — for
this repository, a build, test or lint process.

### Why there is no upstream fix

The advisory's vulnerable range is `<=4.0.7`, and 4.0.7 is the latest published version (`npm view picomatch version`)
at the time of this assessment. There is no fixed release to upgrade to. `npm audit fix` reports the problem as
fixable, but its `--dry-run` resolution is to remove 134 packages — it is satisfying the advisory by deleting the
tooling that depends on picomatch, not by fixing anything. Lockfile churn cannot help while the range remains open.

### Our actual exposure

`npm ls picomatch --all` in this repository resolves to two major lines: `picomatch@4.0.7` (the vulnerable line) and
`picomatch@2.3.2` (outside the advisory range), both reached only through tooling:

| Path                                           | Tree                     | When it runs        |
| ---------------------------------------------- | ------------------------ | ------------------- |
| `knip` → `fdir`, `tinyglobby`, direct          | devDependency            | unused-export check |
| `vite`, `vitest`                               | devDependency            | build, unit tests   |
| `react-native` → `tinyglobby`, `@expo/cli`     | mobile runtime (bundler) | mobile build        |
| `react-native` → `jest` → `micromatch` (2.3.2) | mobile devDependency     | mobile tests        |

`npm ls --workspace=@myvedicstar/web --omit=dev` lists **no picomatch at all**: the vulnerable package is not in the
web runtime dependency tree, so it is not in the browser bundle and no production request can reach it. It also
cannot be reached through the API client, contracts or any code path that handles user input.

A ReDoS here needs an attacker-controlled glob pattern handed to the matcher. The globs in this repository are repo-owned
patterns in `vite.config.ts`, `knip.json`, ESLint/Prettier configuration and CI invocations. The realistic worst case
is a slow local or CI build triggered by a contributor's own configuration change — a denial of service against our own
pipeline, not against users, and one that a reviewed pull request would catch as an obviously hostile config.

Version stability is already constrained: `.npmrc` sets `save-exact`, and the lockfile is committed, so picomatch cannot
silently move to a different range. Any change to the resolved version arrives as a reviewed lockfile diff. Dependabot
is not enabled in this repository; when it is, its PRs land here for the same review.

### Revisit criteria

By **2027-02-18**, or earlier if either happens:

- a picomatch release above the advisory range is published (check `npm view picomatch version` against the advisory's
  vulnerable range, then upgrade, re-run `npm run web:audit`, and delete both the script entry and this section);
- a code path is proposed that passes untrusted input to a glob matcher, which would change the exposure assessment above;
- the package's upstream repository is archived or abandoned, in which case removal of the tooling dependency becomes the
  mitigation.

### What was rejected

- **Bumping the lockfile.** Nothing to bump to; see above.
- **Merging with the audit step red and no record.** That hides this advisory among future ones and trains reviewers to
  ignore a failing gate.
- **Dropping `--audit-level=high` or the audit step altogether.** The gate has to keep failing on everything else.
