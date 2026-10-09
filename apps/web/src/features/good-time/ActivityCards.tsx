import type { MuhurtaActivity } from '@myvedicstar/contracts';
import { type KeyboardEvent, useRef } from 'react';

import { Icon } from '../../shared/components/Icon';
import { activityIcon } from './activityIcons';
import styles from './GoodTimePage.module.css';

/**
 * "What are you planning?" — the activities as a single-select radio group of cards (WAI-ARIA radio group pattern):
 * one tab stop, arrow keys / Home / End move and select, Space selects. The selected card has a border, a filled
 * background and a check mark, and `aria-checked` — never color alone.
 */
export function ActivityCards({
  activities,
  selected,
  labelledBy,
  onSelect,
}: Readonly<{
  activities: readonly MuhurtaActivity[];
  selected: string;
  labelledBy: string;
  onSelect: (key: string) => void;
}>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    activities.findIndex((activity) => activity.key === selected),
  );

  const move = (to: number) => {
    const next = (to + activities.length) % activities.length;
    const activity = activities[next];
    if (!activity) return;
    onSelect(activity.key);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(position + 1),
      ArrowDown: () => move(position + 1),
      ArrowLeft: () => move(position - 1),
      ArrowUp: () => move(position - 1),
      Home: () => move(0),
      End: () => move(activities.length - 1),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={styles.cards}>
      {activities.map((activity, position) => {
        const checked = position === index;
        return (
          <button
            key={activity.key}
            ref={(element) => {
              refs.current[position] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={styles.activity}
            onClick={() => onSelect(activity.key)}
            onKeyDown={(event) => onKeyDown(event, position)}
          >
            <span className={styles.activityIcon}>
              <Icon name={activityIcon(activity.icon)} size={26} />
            </span>
            <span className={styles.activityName}>{activity.name}</span>
            {checked && (
              <span className={styles.activityCheck}>
                <Icon name="check" size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
