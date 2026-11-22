# ui#118 — Finding: VedicProfilesPage empty state is a detached-node race, not an order dependency

Branch: `fix/ui118-vedicprofiles-shuffle` (pushed), rebased onto origin/main `9792b59`.
No product code changed — this PR is the FINDING (per assignment: a finding is an acceptable deliverable).

## 1. Failure condition as a predicate

```
FAILS  when  the empty-state test is not the FIRST test rendered in its file AND a
              previous test's `cleanup()` runs after this test's render has begun,
              so `findByText` resolves with a node whose container was already detached.
PASSES when  the test is first in file order, whatever the seed.
```

The file-order condition is the load-bearing one. Shuffle is only the _observation device_:
it moves the test off position 1. The original issue called this an order dependency;
it is really a **teardown/render interleaving** that order merely exposes.

## 2. Reproduction (deterministic)

```
cd apps/web
npx vitest run src/features/vedic-profiles/VedicProfilesPage.test.tsx \
  --sequence.shuffle --sequence.seed=1
#  Tests  1 failed | 22 passed (23)   -> × shows an empty state ...
```

Seed-insensitive, position-sensitive:

| Command                                            | Result                  |
| -------------------------------------------------- | ----------------------- |
| file alone, `--sequence.shuffle --sequence.seed=1` | **1 failed** / 23       |
| file alone, plain order                            | **23 passed**           |
| pair with KundaliSections, seeds 1, 2, 3           | **fails at every seed** |
| pair with KundaliSections, plain order             | **2 files passed**      |

Full-suite seed=1: 7 failed / 574 — the 7 are this file plus six others that share the
first-render-after-import condition; the empty-state test is the deterministic member.

## 3. Causal chain (each link measured)

1. **`findByText` SUCCEEDS.** The awaited element is returned — the query is not the problem.
   Probe output: `DIAG connected=false bodyHasIt=false`.
   So the test found its text and the node was **already detached** when the assertion ran.
2. **The node is detached, not stale-scoped.** `document.body.contains(node) === false`,
   and it stays false across a macrotask.
3. **What detaches it:** `cleanup()` in `afterEach` of `apps/web/src/test/setup.ts:16`.
   A second `cleanup()` scheduled by the _preceding_ test's teardown unmounts the container
   this test is rendering into. That gives the sequence: pending `cleanup` → render → query
   resolves → `cleanup` fires → assertion sees a detached node.
4. **Why order 1 is immune:** the first test's timing budget absorbs the lazy route chunk load;
   note the import-time `window.scrollTo` noise (from `features/good-time/MobileGoodTime.tsx`)
   that appears **before** the first test in every failing log — the module graph for the page is
   still settling. Later positions have no such budget, so the teardown wins the race.
5. **Not shared mutable state across the test boundary in the classic sense.** There is no
   leaked module variable being read by the next test. The carrier is the **shared DOM container
   and the cleanup queue**, which is why a `finally` restore would not help here — see §5.

## 4. Why the existing guard does not catch it

`useVedicProfiles.ts` has an `alive` ref (`alive.current = false` on unmount) that prevents
writing state after unmount. It **cannot** help: the state write happens _before_ the unmount,
the render commits, the node exists, and only then does cleanup detach it. The hook is correct;
the guarantee it offers is narrower than this test needs.

## 5. If this were shared mutable state, a `finally` restore would hide the damage — it is not

Explicitly tested and ruled out, because it matters for the fix:

- Rendered a _different_ route first, then the empty state in the same file: **both passed**
  (`diag.test.tsx`, 2 tests green). So a preceding _render_ does not poison the next one.
- Adding a macrotask before asserting does not re-attach the node (`connected=false` after
  `setTimeout 0`). So it is a teardown interleaving, not a state snapshot.

Consequence: the fix is **not** "restore state in `finally`", and not "add a retry". A retry
would pass whenever it happens to win the race — exactly the unverified green the assignment
warns about.

## 6. Recommended fix (not applied here — needs a decision on the shared harness)

The defect is in the shared test harness, not in `VedicProfilesPage`:

- **Preferred:** make `setup.ts` teardown synchronous with the unmount it triggers —
  await React 18/19's `act`-settled unmount before the next test renders, i.e. call
  `cleanup()` inside an `act()`/ `await cleanup()`-equivalent so a container can never be
  detached while a query from the _next_ test is in flight.
- **Alternative (narrower):** `isolate`-per-test or a per-test container so a previous test's
  container is never the one being queried.
- A per-file `beforeEach(() => render(...))` in the profiles suite would also stabilise it,
  but it hides the harness defect instead of fixing it.

I am not applying either without approval: `src/test/setup.ts` is shared by 63 test files, and
changing teardown semantics is a cross-cutting test-infra decision, not a profiles-only patch.

## 7. Acceptance status against the issue

- Cause named: **yes** (§3, measured).
- Deterministic reproduction: **yes** (§2, seed- and position-sensitivity tabulated).
- Stable across three consecutive shuffled full-suite runs with no retry/skip/loosened
  assertion: **NOT met** — that requires the harness fix in §6, which needs approval.

## Measured, after the harness was actually changed (2026-11-22)

The recommendation in §6 was tested rather than asserted, and the result contradicts this document's framing:

**1. `act`-settled teardown does not fix it.** Wrapping `cleanup()` in `await act(async () => { cleanup(); })` in
`apps/web/src/test/setup.ts` left `--sequence.shuffle --sequence.seed=1` failing 5/5 (three runs at seed 1, plus
seeds 2 and 3). So "make teardown synchronous with the unmount it triggers" is not the remedy.

**2. The detaching root is not the previous test's container.** Instrumented at the failing assertion
(`VedicProfilesPage.test.tsx`, empty state): the found node is **outside** `document.body`, and `document.body` holds
**exactly one** child. A leftover container from a previous test would show up as a second child. It is not stale DOM
left behind; the node simply is not in the document.

Timing probe with the teardown change applied: of six consecutive seed-1 runs, 2 passed and 4 failed, and the
failures alternate between two shapes — the found node `inDoc=false` at the assertion, or (with an explicit 30 ms
idle probe) detached immediately and still detached. **This is not a fixed seed-reproducible state; it is
run-to-run**, which is what a genuine interleaving looks like.

**3. Consequence for the fix.** The remaining explanation that fits the measurements is that the teardown destroys
the document root this test is rendering into — `@testing-library/react`'s `cleanup()` is called from the shared
`afterEach`, and a scheduled unmount that outlives its own test lands on the _shared_ `document`. A teardown that
cannot reach the next test's document is the only guarantee that removes the class, which points at per-test document
isolation (environment-level) rather than an ordering tweak inside `afterEach`.

**Status: open.** No fix is claimed here. The earlier "preferred fix" in §6 is falsified by measurement; the finding
above is the corrected starting point.

## Hypothesis 2 measured: no root swap, the documented root is gone (2026-11-22)

The next candidate was "the assertion holds a node obtained before a re-render replaced the root". Direct measurements
at the failing assertion, three consecutive seed-1 runs, identical every time:

```
V1  inDoc=false  kids=1  roots=1          # exactly one container in body, not two
V1c parentChain=p  bodyFirstKid=DIV:      # the node's ONLY ancestor is <p>; it is not under any root div
V2  requery=absent                        # a fresh query does not find the text anywhere
V3  bodyTextHas=false  nodes=80           # the text is gone from the document as a whole
```

So:

- **No root swap.** A re-render that replaced the root would leave the old root in the DOM (kids would be 2, or the
  requery would find the text in the new root). Neither happens.
- **The entire tree vanished.** `bodyTextHas=false` with 80 nodes remaining means the document kept its scaffolding
  and lost the page. That is a teardown unmounting the tree this test is using, during the test.
- **Nothing about the test's ordering fixes it.** `cleanup()` from the shared `afterEach` is a valid, documented
  detacher; the numbers say it is reaching the _current_ test's document.

## Conclusion: this is a harness decision, not a test fix

I am not shipping a fix. Two attempts are measured and falsified above (act-settled teardown, 5/5 fail; ordering
changes, no effect). The remaining remedies all change shared test infrastructure — a document root per test (so a
teardown cannot reach a later test's document), or running this suite with file/test isolation — and that is exactly
the §6 decision that #141 deferred and that this branch must not make unilaterally: `apps/web/src/test/setup.ts` is
shared by every web test file.

What this branch does deliver: the empty-state assertion now proves membership in the document (and of every
ancestor) instead of only that `findBy*` returned a node, which turns the live failure into a truthful, readable one;
and the record above so nobody re-tests the two falsified remedies.
