#!/usr/bin/env tsx
/**
 * Verifies that every generated CSS-module declaration agrees with the stylesheet it describes (ui#127).
 *
 * This is the guarantee. The generator alone is not one: if it emits nothing, or partial output, TypeScript falls back
 * to the permissive index signature, everything compiles, and the repository is exactly as unsafe as before while
 * APPEARING protected. A generator that can fail silently is a coat of paint over the wildcard.
 *
 * Two lists, derived independently:
 *   A = classes CLAIMED by the generated .d.ts
 *   B = classes PARSED from the .module.css source, read at assertion time
 *
 * Equality is PER MODULE, never a total. A total survives a generator that drops `sectionTitle` from module X and
 * invents `bogus` in module Y: wrong twice, and a scalar cannot show it because a scalar covers a set but cannot
 * represent a swap.
 *
 * Both directions are checked, and the second is the one no other gate sees:
 *   - missing  => the component renders unstyled (the ui#125 defect).
 *   - invented => a declaration that outlived the thing it declares: the reference resolves, the class is declared, and
 *                 the CSS rule is gone. Nothing else in this repository would catch that.
 *
 * B reuses ui#125's parser, which is proven to fail correctly in both directions. That is not circular: the circularity
 * to avoid is deriving B FROM THE GENERATOR, i.e. consuming the subject under test.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const WEB_SRC = resolve(import.meta.dirname, '../../../apps/web/src');

function walk(dir: string, suffix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full, suffix));
    } else if (entry.name.endsWith(suffix)) {
      found.push(full);
    }
  }
  return found;
}

/** Classes defined by a stylesheet: selector-position classes at any nesting depth, excluding :global(...). */
function definedClasses(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const names = new Set<string>();
  let buffer = '';
  let inGlobal = 0;

  for (let index = 0; index < withoutComments.length; index += 1) {
    const character = withoutComments[index];
    if (character === '{') {
      for (const match of buffer.matchAll(/(?<![\w-])\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) {
        if (inGlobal === 0) {
          names.add(match[1] as string);
        }
      }
      buffer = '';
    } else if (character === '}') {
      buffer = '';
    } else if (character === ';') {
      buffer = buffer.replace(/[^{]*$/, '');
    } else {
      buffer += character;
    }

    if (withoutComments.startsWith(':global(', index)) {
      inGlobal += 1;
      index += ':global('.length - 1;
    } else if (character === ')' && inGlobal > 0) {
      inGlobal -= 1;
    }
  }

  return names;
}

/** Classes claimed by a generated declaration file. */
function claimedClasses(declaration: string): Set<string> {
  const names = new Set<string>();
  for (const match of declaration.matchAll(/readonly '([^']+)': string;/g)) {
    names.add(match[1] as string);
  }
  return names;
}

const modules = walk(WEB_SRC, '.module.css');
if (modules.length === 0) {
  console.error('typed-css-modules: no .module.css files found; the assertion would pass vacuously.');
  process.exit(1);
}

const problems: string[] = [];
let checkedClasses = 0;

for (const modulePath of modules) {
  const displayPath = relative(WEB_SRC, modulePath);
  const declarationPath = modulePath + '.d.ts';

  if (!existsSync(declarationPath)) {
    problems.push(
      displayPath +
        ': no generated declaration. TypeScript would fall back to the permissive index signature, so the',
    );
    problems.push('  classes in this module are unchecked. Run `npm run types:css`.');
    continue;
  }

  const actual = definedClasses(readFileSync(modulePath, 'utf8'));
  const claimed = claimedClasses(readFileSync(declarationPath, 'utf8'));
  checkedClasses += actual.size;

  const missing = [...actual].filter((name) => !claimed.has(name)).sort();
  const invented = [...claimed].filter((name) => !actual.has(name)).sort();

  if (missing.length > 0) {
    problems.push(displayPath + ': declaration is MISSING ' + missing.join(', '));
  }
  if (invented.length > 0) {
    problems.push(
      displayPath +
        ': declaration INVENTS ' +
        invented.join(', ') +
        ' - a declared class the stylesheet no longer defines. Every reference to it resolves and no rule renders.',
    );
  }
}

if (problems.length > 0) {
  console.error('CSS module declarations disagree with their stylesheets:');
  for (const problem of problems) {
    console.error('  ' + problem);
  }
  console.error('');
  console.error(
    'Run `npm run types:css` to regenerate. If that does not fix it, the generator itself is wrong,',
  );
  console.error('which is the failure this check exists to make loud rather than silent.');
  process.exit(1);
}

console.warn(
  'CSS module declarations verified: ' + modules.length + ' modules, ' + checkedClasses + ' classes.',
);
