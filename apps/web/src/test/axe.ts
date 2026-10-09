import axe from 'axe-core';

/**
 * Runs axe-core against a rendered container and returns readable violations (empty when accessible).
 * jsdom cannot compute layout, so color-contrast is checked in E2E (real browser) and in design-token tests instead.
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}
