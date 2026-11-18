import type { ChartHouse, ChartStyle } from '@myvedicstar/contracts';

/**
 * Geometry for the three Indian chart styles.
 *
 * All three are pure functions of the SAME `houses` array, which is what guarantees a style change cannot alter a
 * fact: there is no per-style data, only per-style coordinates. That is also why switching style needs no engine call
 * and no refetch - it is a re-render of the same numbers.
 *
 * Each style returns one cell per house with its polygon points and the label anchor point, so the renderer stays
 * dumb and the geometry stays testable without a DOM.
 */

/** The fixed house order differs between styles, which is the whole reason they need separate layouts. */
export interface ChartCell {
  /** 1-based house number this cell represents. */
  house: number;
  /** SVG polygon points, already in the 0..100 viewBox space. */
  points: string;
  /** Where the sign/planet text is centred. */
  x: number;
  y: number;
}

const SIZE = 100;

/** North Indian: a square with both diagonals and a rotated inner diamond. Houses are fixed, the LAGNA rotates. */
function northIndianCells(): ChartCell[] {
  const m = SIZE / 2;
  const q = SIZE / 4;
  return [
    { house: 1, points: `0,${q} ${q},0 ${m},${q} ${q},${m}`, x: q, y: q },
    { house: 2, points: `${q},0 ${m},0 ${m},${q} ${q},${m}`, x: q + q / 2, y: q / 2 },
    { house: 3, points: `${m},0 ${SIZE},${q} ${SIZE},${m} ${m},${q}`, x: SIZE - q / 2, y: q / 2 },
    { house: 4, points: `${SIZE},${q} ${SIZE},${SIZE - q} ${SIZE - q},${SIZE} ${m},${m}`, x: SIZE - q, y: m },
    {
      house: 5,
      points: `${SIZE - q},${SIZE} ${m},${SIZE} ${m},${SIZE - q} ${SIZE - q},${m}`,
      x: SIZE - q,
      y: SIZE - q / 2,
    },
    { house: 6, points: `${q},${SIZE} 0,${SIZE - q} 0,${m} ${q},${SIZE - q}`, x: q - q / 2, y: SIZE - q / 2 },
    { house: 7, points: `0,${q} 0,${SIZE - q} ${q},${SIZE - q} ${q},${q}`, x: q / 2, y: m },
    { house: 8, points: `0,${q} ${q},${q} ${q},${SIZE - q} 0,${SIZE - q}`, x: q / 2, y: SIZE - q },
    { house: 9, points: `0,${q} ${m},${m} ${SIZE},${q} ${q},${q}`, x: q / 2, y: q },
    { house: 10, points: `${m},0 ${SIZE},${q} ${SIZE - q},${q} ${m},${m}`, x: m, y: q / 2 },
    { house: 11, points: `${m},${m} ${SIZE},${q} ${SIZE},${SIZE - q} ${m},${SIZE}`, x: SIZE - q, y: m },
    { house: 12, points: `${m},${m} ${m},${SIZE} ${q},${SIZE} ${SIZE - q},${q}`, x: q, y: m },
  ];
}

/** South Indian: a fixed 4x4 ring, houses fixed to signs, so only the sign labels move. */
function southIndianCells(): ChartCell[] {
  const s = SIZE / 4;
  // Clockwise from the top-left inner cell.
  const order: [number, number][] = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [2, 3],
    [1, 3],
    [0, 3],
    [0, 2],
    [0, 1],
  ];
  return order.map(([col, row], index) => ({
    house: index + 1,
    points: `${col * s},${row * s} ${(col + 1) * s},${row * s} ${(col + 1) * s},${(row + 1) * s} ${col * s},${(row + 1) * s}`,
    x: col * s + s / 2,
    y: row * s + s / 2,
  }));
}

/** East Indian: a square of nine cells plus four corner triangles; houses run anticlockwise. */
function eastIndianCells(): ChartCell[] {
  const t = SIZE / 3;
  const cells: ChartCell[] = [];
  const ring: [number, number][] = [
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
    [1, 2],
    [0, 2],
    [0, 1],
    [0, 0],
  ];
  ring.forEach(([col, row], index) => {
    cells.push({
      house: index + 1,
      points: `${col * t},${row * t} ${(col + 1) * t},${row * t} ${(col + 1) * t},${(row + 1) * t} ${col * t},${(row + 1) * t}`,
      x: col * t + t / 2,
      y: row * t + t / 2,
    });
  });
  // Four corner triangles carry the remaining houses.
  const corners: [string, number, number, number][] = [
    [`0,0 ${t},${t} 0,${t}`, 9, t / 3, t / 2],
    [`${SIZE},0 ${SIZE},${t} ${SIZE - t},${t}`, 10, SIZE - t / 3, t / 2],
    [`${SIZE},${SIZE} ${SIZE - t},${SIZE - t} ${SIZE - t},${SIZE}`, 11, SIZE - t / 3, SIZE - t / 2],
    [`0,${SIZE} 0,${SIZE - t} ${t},${SIZE - t}`, 12, t / 3, SIZE - t / 2],
  ];
  for (const [points, house, x, y] of corners) cells.push({ house, points, x, y });
  return cells;
}

/**
 * Returns the cells for a style, paired with the caller's houses in house order.
 *
 * Both the north and east layouts are drawn with house 1 fixed at the top-left and the LAGNA sign rotating through
 * the labels; south Indian fixes signs to cells instead. In every case the data is the same array.
 */
export function layoutFor(style: ChartStyle): ChartCell[] {
  if (style === 'south-indian') return southIndianCells();
  if (style === 'east-indian') return eastIndianCells();
  return northIndianCells();
}

/** Pairs each cell with its house data, so a cell never renders a house the payload did not supply. */
export function cellsWithHouses(
  style: ChartStyle,
  houses: readonly ChartHouse[],
): { cell: ChartCell; house: ChartHouse }[] {
  const cells = layoutFor(style);
  return cells.flatMap((cell) => {
    const house = houses[cell.house - 1];
    return house ? [{ cell, house }] : [];
  });
}
