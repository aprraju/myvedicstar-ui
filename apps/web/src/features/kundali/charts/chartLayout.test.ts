import { chartStyleValues } from '@myvedicstar/contracts';
import { describe, expect, it } from 'vitest';

import { cellsWithHouses, layoutFor } from './chartLayout';
import { chartComputed } from './fixtures';

describe('KUN-07 chart geometry', () => {
  it('gives every style twelve cells covering houses 1..12 exactly once', () => {
    for (const style of chartStyleValues) {
      const cells = layoutFor(style);
      expect(cells, style).toHaveLength(12);
      expect(new Set(cells.map((cell) => cell.house)).size, style).toBe(12);
      expect(
        cells.map((cell) => cell.house).sort((a, b) => a - b),
        style,
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it('produces polygons and anchors inside the viewBox for every style', () => {
    for (const style of chartStyleValues) {
      for (const cell of layoutFor(style)) {
        expect(cell.x, `${style} x`).toBeGreaterThanOrEqual(0);
        expect(cell.x, `${style} x`).toBeLessThanOrEqual(100);
        expect(cell.y, `${style} y`).toBeGreaterThanOrEqual(0);
        expect(cell.y, `${style} y`).toBeLessThanOrEqual(100);
        for (const point of cell.points.split(' ')) {
          for (const value of point.split(',').map(Number)) {
            expect(Number.isFinite(value), `${style} point`).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('shows identical house facts in all three styles', () => {
    // The core guarantee: a style change is geometry only. Same houses, same signs, same planets.
    const perStyle = chartStyleValues.map((style) =>
      cellsWithHouses(style, chartComputed.houses).map(({ house }) => house),
    );
    expect(perStyle[0]).toEqual(perStyle[1]);
    expect(perStyle[1]).toEqual(perStyle[2]);
  });

  it('never pairs a cell with a house the payload did not supply', () => {
    // A short payload must not invent houses 10-12.
    const short = chartComputed.houses.slice(0, 8);
    const paired = cellsWithHouses('north-indian', short);
    expect(paired).toHaveLength(8);
    expect(paired.every(({ house }) => house !== undefined)).toBe(true);
  });
});
