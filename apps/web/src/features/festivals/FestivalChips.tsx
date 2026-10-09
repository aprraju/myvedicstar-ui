import type { Festival } from '@myvedicstar/contracts';

import styles from './FestivalChips.module.css';

/** Compact list of a day's festivals and observances: backend icon (decorative) and name, styled by category. */
export function FestivalChips({
  festivals,
  label,
}: Readonly<{ festivals: readonly Festival[]; label?: string }>) {
  if (festivals.length === 0) return null;
  return (
    <ul className={styles.chips} aria-label={label}>
      {festivals.map((festival) => (
        <li
          key={`${festival.key}-${festival.date}`}
          className={styles.chip}
          data-category={festival.category}
        >
          {festival.icon && <span aria-hidden="true">{festival.icon}</span>}
          <span>{festival.name}</span>
        </li>
      ))}
    </ul>
  );
}
