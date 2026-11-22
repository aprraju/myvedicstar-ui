## Harness decision (§6) — the predicate, with the remedies that fail recorded

Worktree: /mnt/disk/repos/worktrees/ui-developer, branch fix/ui118-harness-decision, based on 1a86e77.

### The predicate, from measurement

```
The empty-state node is ATTACHED when findByText resolves and DETACHED two macrotasks later,
while document.body still holds exactly one child. The container is not removed; its SUBTREE is replaced.
```

Probe with two tests in a scratch file at --sequence.seed=1, faithful to the real timing:

```
first=true  after2=false  bodyKids=1
```

The DOM scaffold is stable across 0/30/120/400ms (one DIV with 2 children, text present) — the document is never torn down. This corroborates #147 from the other direction: the tree vanishes from inside the container, not because the container goes away.

### Remedies measured and falsified (mine, in addition to #147's two)

| Remedy                                                                                   | Result at seed 1                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------- |
| #147: act-settled teardown                                                               | 5/5 fail (already recorded)           |
| #147: teardown reordering                                                                | 2 pass / 4 fail (already recorded)    |
| Explicit container removal in afterEach (cleanup, then remove every non-root body child) | 2 fail / 1 pass in 3 runs — no better |

Three independent teardown shapes leave it failing. The teardown is not the detacher; something replaces the subtree while the test is still running.

### The decision

Documented harness decision, not a fix. Per the assignment's second option: pin the failing seed in a skip that names the reason, and keep expectRendered (already on main) so the failure mode can never be silent again.

The skip is scoped to the exact seed the flake needs, so the test keeps running everywhere else and cannot rot unnoticed: a skipIf keyed on the shuffle seed, with a comment naming the predicate above, the three falsified remedies, and the issue number. No assertion is deleted and no matcher loosened — the assertion stays exact wherever it can hold.

### Why not a fix

The remaining candidate is a render-identity change under the app's own providers (a provider value that changes identity after first paint and remounts the subtree). That is production code with blast radius across every page, and I have not proved it — proposing it on this evidence would be the tautology class rejected for retry. It needs its own investigation and its own repro.

### Why not just add a retry wait

A retry passes whenever it wins the race — exactly the unverified green that is worse than an open issue.

### What this PR contains

- The skip with the named reason, pinned to the failing seed.
- A pointer to this predicate so the next investigator starts from measurement rather than from "it is flaky".
- Nothing else: no setup.ts change, no production code, no weakened assertion.
