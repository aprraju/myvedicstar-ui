/**
 * Rendered-size helpers for tests, because jsdom has no layout engine.
 *
 * `getBoundingClientRect()` returns an all-zero rectangle in jsdom for every element, so a test that asserts a rendered
 * box through that API proves nothing - it would fail for a correct control and pass for nothing at all. These helpers
 * derive the size from the cascade instead: the component's own CSS-module rule, and the resolved value of the custom
 * property it points at.
 *
 * That is a real measurement of the declaration chain (module -> token -> px), not a copy of the stylesheet: the test
 * fails when the rule is removed, when the token is undefined, and when the token resolves below the requirement. It
 * cannot see media queries or a browser's final layout, which is why the assertion is on the smallest stated size
 * (the mobile rule) and the E2E lane remains the place real layout is measured.
 */

/**
 * Reads `<selector> { <property>: <value> }` out of a stylesheet text and returns the declared value.
 *
 * Deliberately literal rather than a CSS parser: the rules these tests pin are single declarations in a module we own,
 * and a silent no-match would make the test vacuous, so a missing rule throws with the selector in the message.
 */
export function declaredValue(css: string, selector: string, property: string): string {
  // Plain substring search rather than a RegExp built from the selector: a selector contains "." ":" and "(", and an
  // escaping bug there would either throw "no rule" for a rule that exists or, worse, silently match the wrong one.
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex === -1) throw new Error(`no CSS rule for "${selector}" in the stylesheet under test`);

  const open = css.indexOf('{', selectorIndex + selector.length);
  // A selector that is a prefix of another (.hint vs .hintStrong) would otherwise read the wrong block; require that only
  // whitespace or a comma sits between the matched name and the brace.
  const between = css.slice(selectorIndex + selector.length, open);
  if (open === -1 || between.trim().replace(/,$/, '').length > 0 || between.includes('{')) {
    throw new Error(`"${selector}" is not a complete selector: "${between.trim()}" follows it`);
  }
  const close = css.indexOf('}', open);
  if (close === -1) throw new Error(`unterminated rule for "${selector}"`);
  const body = css.slice(open + 1, close);

  const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'm').exec(body);
  if (!declaration?.[1]) {
    throw new Error(
      `rule "${selector}" declares no "${property}"; it declares: ${body.trim().replace(/\\s+/g, ' ')}`,
    );
  }
  return declaration[1].trim();
}

/**
 * Resolves a length from the cascade for one element: an absolute length is returned as-is, and a `var(--x)` reference
 * is resolved through the custom property's computed value on the same element (which is how a token reaches a rule in
 * a browser). Throws when the token is not defined, rather than falling back to a number the test invented.
 */
export function resolvedLength(element: Element, declared: string): number {
  const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(declared.trim());
  if (!reference?.[1]) return toPixels(declared);
  const custom = getComputedStyle(element).getPropertyValue(reference[1]).trim();
  if (!custom)
    throw new Error(`custom property ${reference[1]} is not defined on ${element.tagName.toLowerCase()}`);
  return toPixels(custom);
}

function toPixels(value: string): number {
  const match = /^(-?[\d.]+)px$/.exec(value.trim());
  if (!match?.[1])
    throw new Error(`"${value}" is not an absolute px length; jsdom cannot resolve other units`);
  return Number(match[1]);
}
