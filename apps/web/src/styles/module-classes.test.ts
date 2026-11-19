/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/*
 * This guard reads the real files from disk rather than importing them.
 *
 * Importing is not an option: the test environment transforms `.module.css` into a class-name object, so `?raw` yields
 * that object ("css.replace is not a function") and `?inline` yields an empty string. Both were tried. Reading the
 * filesystem is the only way to see the stylesheet source as written, which is what has to be checked.
 *
 * The triple-slash reference pulls in `@types/node` for this file only. The app's tsconfig sets `types: ['vite/client']`
 * for the browser bundle, and widening that for the whole app would be a build-config change this test does not need.
 */
const SRC_ROOT = resolve(__dirname, '..');

/** Recursively list files under `dir` whose name passes `keep`. */
function walk(dir: string, keep: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full, keep));
    } else if (keep(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Every `styles.X` a component references must be a class its CSS module actually defines (ui#125).
 *
 * A missing CSS-module class is `undefined`, and `className={undefined}` renders silently: no test fails, no lint rule
 * fires and no type error is raised. It is not caught by the compiler because `vite/client.d.ts` declares module classes
 * as `{ readonly [key: string]: string }` - an index signature that tells TypeScript every key exists, so even
 * `noUncheckedIndexedAccess` cannot help. The defect shipped once already (#109) with eight unstyled classes.
 *
 * This test reads the real files. It deliberately does NOT use a curated list of known-missing classes: a list can only
 * catch what somebody already thought of, which is the same defect one level up.
 *
 * NOTE: this asserts at test time. It only fails if the suite runs. A typed CSS module would fail at authoring time, in
 * every editor; that is a stronger fix and is tracked separately. "Styled" is not "detectable" - this is the detection.
 */

/** Repo-relative path with forward slashes, for stable messages. */
function repoPath(file: string): string {
  return relative(SRC_ROOT, file).split('\\').join('/');
}

/**
 * Class names a CSS module exports.
 *
 * A class is exported if it appears in the *selector* position of any rule, at any nesting depth: indented blocks are
 * ordinary rules inside `@media`/`@supports`, and `.parent .child { }` defines BOTH `.parent` and `.child`. An earlier
 * version of this function only read top-level selectors and reported 13 files of false positives, which would have made
 * the guard worse than useless.
 *
 * Excluded: anything inside a declaration block (declarations cannot define a class) and `:global(...)` content, which
 * CSS modules does not export.
 */
function definedClasses(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const names = new Set<string>();

  // Walk the stylesheet, tracking brace depth so that text inside a declaration block is never read as a selector.
  // At depth 0 a line starts a selector; at depth >= 1 a line can still be a nested selector (CSS nesting is used here,
  // e.g. ".mobileShell > footer" inside "@media"), so selectors are collected at every depth and filtered afterwards.
  let buffer = '';
  let inGlobal = 0;
  for (let index = 0; index < withoutComments.length; index += 1) {
    const character = withoutComments[index];
    if (character === '{') {
      // Everything accumulated since the last `}` or `;` is a selector list; harvest its class names.
      for (const match of buffer.matchAll(/(?<![\w-])\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) {
        if (inGlobal === 0) {
          names.add(match[1] as string);
        }
      }
      buffer = '';
    } else if (character === '}' || character === ';') {
      // A selector list never spans a declaration terminator, but nested rules end with `}`, so reset either way.
      if (character === '}') {
        buffer = '';
      } else {
        buffer = buffer.replace(/[^{]*$/, '');
      }
    } else {
      buffer += character;
    }

    // Track :global(...) so classes inside it are not treated as exported.
    if (withoutComments.startsWith(':global(', index)) {
      inGlobal += 1;
      index += ':global('.length - 1;
    } else if (character === ')' && inGlobal > 0) {
      inGlobal -= 1;
    }
  }

  return names;
}

/**
 * The local binding name a file uses for its CSS module default import, keyed by the resolved module path.
 *
 * The binding is read from the import rather than assumed to be `styles`: one file in this repo imports as
 * `settingsStyles`, and a guard that hard-coded `styles` would silently stop checking that file.
 */
function moduleImports(source: string, fromFile: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+\.module\.css)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const [, binding, specifier] = match;
    if (binding && specifier) {
      found.set(resolve(dirname(fromFile), specifier), binding);
    }
  }
  return found;
}

/**
 * A reference to a module class, with the line it appears on.
 *
 * `styles.foo` is a static reference. `styles[expr]` is a computed one: it cannot be checked statically, so it is
 * reported as computed and handled by the caller rather than skipped - a guard that silently skips computed access has
 * a hole shaped exactly like the bug it exists to catch.
 */
interface Reference {
  name: string;
  line: number;
  computed: boolean;
  /** For computed access, the index expression as written, e.g. `variant`. */
  expression?: string;
}

function references(source: string, binding: string): Reference[] {
  const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const staticPattern = new RegExp(`\\b${escaped}\\.([A-Za-z_$][\\w$]*)`, 'g');
  const computedPattern = new RegExp(`\\b${escaped}\\[([^\\]]+)\\]`, 'g');
  const found: Reference[] = [];
  const lines = source.split('\n');

  lines.forEach((text, index) => {
    for (const match of text.matchAll(staticPattern)) {
      const name = match[1];
      if (name) {
        found.push({ name, line: index + 1, computed: false });
      }
    }
    for (const match of text.matchAll(computedPattern)) {
      const expression = match[1]?.trim() ?? '';
      found.push({ name: `[${expression}]`, line: index + 1, computed: true, expression });
    }
  });
  return found;
}

/**
 * Components whose computed `styles[expr]` access is sanctioned.
 *
 * The escape is an explicit, greppable entry naming the file, the binding and the index expression, plus the reason. It
 * exists so that the honest response to this guard is a one-line annotation, not a weakened guard: a guard with no
 * sanctioned exception gets deleted the first time it blocks legitimate work.
 *
 * Each entry must still be justified: the index expression is a union of string literals whose members are all classes
 * defined by that module, so the classes reached are bounded and checkable by eye.
 */
interface SanctionedComputedAccess {
  file: string;
  binding: string;
  expression: string;
  reason: string;
}

const SANCTIONED_COMPUTED_ACCESS: readonly SanctionedComputedAccess[] = [
  {
    file: 'shared/components/Button.tsx',
    binding: 'styles',
    expression: 'variant',
    reason:
      "'variant' is the union 'primary' | 'secondary' | 'ghost' and Button.module.css defines all three; the reachable classes are bounded by the type.",
  },
];

/**
 * Unresolved references that already exist on `main` and are NOT part of ui#125.
 *
 * These are recorded, not fixed: fixing them is someone else's active feature area, and silently changing another
 * feature's styling inside a detection issue is how an unrelated regression ships. This is a *debt ledger*, and it has
 * two properties that keep it from becoming the thing the issue warns against (a curated list that can only catch what
 * somebody already thought of):
 *
 *  1. It is keyed by the exact `file:class` pair. A new unresolved reference anywhere - including a *new* class in one of
 *     these same files - fails the test. It suppresses specific known findings, not a class of defect.
 *  2. Every entry names the issue that should fix it, and the list may only shrink: an entry whose class now resolves
 *     fails the test as stale. So the ledger cannot quietly grow to swallow future bugs.
 */
interface KnownUnresolvedReference {
  file: string;
  className: string;
  issue: string;
}

const KNOWN_UNRESOLVED_REFERENCES: readonly KnownUnresolvedReference[] = [
  { file: 'features/kundali/KundaliSections.tsx', className: 'sections', issue: 'ui#128' },
  { file: 'features/kundali/bala/BalaSection.tsx', className: 'notMeasured', issue: 'ui#128' },
  { file: 'features/kundali/bala/StrengthBar.tsx', className: 'excludeNote', issue: 'ui#128' },
  { file: 'features/kundali/overview/AstroDetails.tsx', className: 'placements', issue: 'ui#128' },
  { file: 'features/kundali/overview/FieldValue.tsx', className: 'unavailableText', issue: 'ui#128' },
  { file: 'features/kundali/yogas/YogaAssessmentItem.tsx', className: 'factorGroup', issue: 'ui#128' },
];

describe('CSS module class references (ui#125)', () => {
  it('every styles.X reference resolves to a class the module defines', () => {
    const modules = walk(SRC_ROOT, (name) => name.endsWith('.module.css'));
    expect(modules.length).toBeGreaterThan(0);

    const classesByModule = new Map<string, Set<string>>();
    for (const file of modules) {
      classesByModule.set(file, definedClasses(readFileSync(file, 'utf8')));
    }

    const consumers = walk(
      SRC_ROOT,
      (name) => /\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx'),
    );

    const problems: string[] = [];
    for (const file of consumers) {
      const source = readFileSync(file, 'utf8');
      const imports = moduleImports(source, file);
      if (imports.size === 0) continue;

      for (const [modulePath, binding] of imports) {
        const defined = classesByModule.get(modulePath);
        if (!defined) {
          problems.push(`${repoPath(file)} imports ${repoPath(modulePath)}, which does not exist`);
          continue;
        }

        for (const ref of references(source, binding)) {
          if (ref.computed) {
            const sanctioned = SANCTIONED_COMPUTED_ACCESS.some(
              (entry) =>
                entry.file === repoPath(file) &&
                entry.binding === binding &&
                entry.expression === ref.expression,
            );
            if (!sanctioned) {
              problems.push(
                `${repoPath(file)}:${ref.line} uses computed ${binding}[${ref.expression}], which cannot be verified statically. ` +
                  `If it is legitimate, add an entry to SANCTIONED_COMPUTED_ACCESS in this file naming the file, binding and expression with a reason; ` +
                  `otherwise reference the class statically.`,
              );
            }
            continue;
          }

          if (!defined.has(ref.name)) {
            const known = KNOWN_UNRESOLVED_REFERENCES.some(
              (entry) => entry.file === repoPath(file) && entry.className === ref.name,
            );
            if (!known) {
              problems.push(
                `${repoPath(file)}:${ref.line} references ${binding}.${ref.name}, which ${repoPath(modulePath)} does not define`,
              );
            }
          }
        }
      }
    }

    expect(problems).toEqual([]);

    // The ledger must not outlive its findings: an entry whose class now resolves is stale and must be deleted, so the
    // list can only ever shrink towards empty. Without this, the ledger would silently accumulate dead entries that make
    // it look like more is excused than actually is.
    const stale = KNOWN_UNRESOLVED_REFERENCES.filter((entry) => {
      const consumerFile = join(SRC_ROOT, entry.file);
      const imports = moduleImports(readFileSync(consumerFile, 'utf8'), consumerFile);
      return [...imports.keys()].some(
        (candidate) => classesByModule.get(candidate)?.has(entry.className) === true,
      );
    });

    expect(
      stale.map(
        (entry) =>
          `${entry.file} ${entry.className} now resolves - remove it from KNOWN_UNRESOLVED_REFERENCES (${entry.issue})`,
      ),
    ).toEqual([]);
  });
});
