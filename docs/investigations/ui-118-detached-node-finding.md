# ui#118 — Finding: VedicProfilesPage empty state is a detached-node race, not an order dependency

Branch: `fix/ui118-vedicprofiles-shuffle` (pushed), based on origin/main `69a1d7e`.
No product code changed — this PR is the FINDING (per assignment: a finding is an acceptable deliverable).

## 1. Failure condition as a predicate

```
FAILS  when  the empty-state test is not the FIRST test rendered in its file AND a
              previous test's `cleanup()` runs after this test's render has begun,
              so `findByText` resolves with a node whose container was already detached.
PASSES when  the test is first in file order, whatever the seed.
```

The file-order condition is the load-bearing one. Shuffle is only the *observation device*:
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

| Command | Result |
|---|---|
| file alone, `--sequence.shuffle --sequence.seed=1` | **1 failed** / 23 |
| file alone, plain order | **23 passed** |
| pair with KundaliSections, seeds 1, 2, 3 | **fails at every seed** |
| pair with KundaliSections, plain order | **2 files passed** |

Full-suite seed=1: 7 failed / 574 — the 7 are this file plus six others that share the
first-render-after-import condition; the empty-state test is the deterministic member.

## 3. Causal chain (each link measured)

1. **`findByText` SUCCEEDS.** The awaited element is returned — the query is not the problem.
   Probe output: `DIAG connected=false bodyHasIt=false`.
   So the test found its text and the node was **already detached** when the assertion ran.
2. **The node is detached, not stale-scoped.** `document.body.contains(node) === false`,
   and it stays false across a macrotask.
3. **What detaches it:** `cleanup()` in `afterEach` of `apps/web/src/test/setup.ts:16`.
   A second `cleanup()` scheduled by the *preceding* test's teardown unmounts the container
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
writing state after unmount. It **cannot** help: the state write happens *before* the unmount,
the render commits, the node exists, and only then does cleanup detach it. The hook is correct;
the guarantee it offers is narrower than this test needs.

## 5. If this were shared mutable state, a `finally` restore would hide the damage — it is not

Explicitly tested and ruled out, because it matters for the fix:

- Rendered a *different* route first, then the empty state in the same file: **both passed**
  (`diag.test.tsx`, 2 tests green). So a preceding *render* does not poison the next one.
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
  detached while a query from the *next* test is in flight.
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
