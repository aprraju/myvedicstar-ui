import type { PlanetDetail } from '@myvedicstar/contracts';

import { useTranslation, useTranslator } from '../../../shared/i18n/I18nProvider';
import { type CellView, reasonFor, resolveCell } from './cells';
import { ReasonText } from './MethodNotice';
import styles from './Planets.module.css';
import { aspectTypeLabel, dignityLabel, dignityScale, planetLabel, relationshipLabel } from './vocabulary';

/**
 * One table cell.
 *
 * There are exactly three renderings and no fourth: a value, an explicitly unavailable cell with its reason, or a
 * fact that is not applicable at all (a flag that is simply false). Nothing renders as a dash, a blank or a zero.
 * The reason is always present for an unavailable cell and is announced to assistive technology.
 */
function Cell<T>({
  view,
  column,
  children,
}: {
  view: CellView<T>;
  column: string;
  children: (value: T) => React.ReactNode;
}) {
  const { t } = useTranslation();

  if (view.kind === 'unavailable') {
    return (
      <td className={styles.unavailableCell} data-state="unavailable">
        <span className={styles.unavailable}>{t('kundali.overview.unavailable')}</span>
        <ReasonText reason={view.reason} />
        <span className="visually-hidden"> — {column}</span>
      </td>
    );
  }

  return <td data-state="value">{children(view.value)}</td>;
}

/** Sign, degree and the combined position, all read from the payload — never derived from each other here. */
function PositionCells({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();

  // Sign and degree are separate facts. A sign with no degree is a legitimate engine answer, so each is resolved on its
  // own rather than printing "Leo, —".
  return (
    <>
      <Cell view={resolveCell(planet, 'sign', planet.sign)} column={t('kundali.planets.column.sign')}>
        {(sign) => sign}
      </Cell>
      <Cell
        view={resolveCell(planet, 'degreeInSign', planet.degreeInSign)}
        column={t('kundali.planets.column.degree')}
      >
        {(degree) => (
          <span className={styles.numeric}>{t('kundali.planets.degreeValue', { degree })}</span>
        )}
      </Cell>
    </>
  );
}

function NakshatraCell({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();

  if (planet.nakshatra === undefined) {
    return (
      <Cell view={resolveCell(planet, 'nakshatra', undefined)} column={t('kundali.planets.column.nakshatra')}>
        {() => null}
      </Cell>
    );
  }

  if (planet.pada === undefined) {
    // The nakshatra is known but its pada is not. That is a partial answer and is labelled as such instead of
    // printing the nakshatra alone and letting the reader assume the pada was resolved.
    return (
      <td data-state="partial">
        {planet.nakshatra}
        <span className={styles.unavailable}>
          {' — '}
          {t('kundali.planets.padaMissing')}
        </span>
        <ReasonText reason={reasonFor(planet, 'pada')} />
        <span className="visually-hidden"> — {t('kundali.planets.column.nakshatra')}</span>
      </td>
    );
  }

  return (
    <td data-state="value">
      {t('kundali.planets.nakshatraPada', { nakshatra: planet.nakshatra, pada: planet.pada })}
    </td>
  );
}

function DignityCell({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();
  const translator = useTranslator();
  const view = resolveCell(planet, 'dignity', planet.dignity);

  return (
    <Cell view={view} column={t('kundali.planets.column.dignity')}>
      {(dignity) => (
        // Strength is conveyed by the label itself, not by colour alone; the scale attribute is available to styling.
        <span data-dignity={dignity} data-dignity-step={dignityScale.indexOf(dignity) + 1}>
          {dignityLabel(translator, dignity)}
        </span>
      )}
    </Cell>
  );
}

/**
 * Flags: retrograde and combust.
 *
 * These are two-state facts, and "not retrograde" is a real, computed answer — so false is shown as "Direct" rather
 * than an empty cell. When the engine did not say, the fact is unavailable with its reason, which is different from a
 * computed "no".
 */
function FlagCells({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();

  return (
    <>
      <Cell
        view={resolveCell(planet, 'retrograde', planet.retrograde)}
        column={t('kundali.planets.column.retrograde')}
      >
        {(retrograde) =>
          retrograde ? (
            <span className={styles.flag}>{t('kundali.planets.retrograde')}</span>
          ) : (
            <span className={styles.flagNeutral}>{t('kundali.planets.direct')}</span>
          )
        }
      </Cell>
      <Cell view={resolveCell(planet, 'combust', planet.combust)} column={t('kundali.planets.column.combust')}>
        {(combust) =>
          combust ? (
            <span className={styles.flag}>{t('kundali.planets.combust')}</span>
          ) : (
            <span className={styles.flagNeutral}>{t('kundali.planets.notCombust')}</span>
          )
        }
      </Cell>
    </>
  );
}

function RelationshipsCell({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();
  const translator = useTranslator();

  if (planet.relationships === undefined || planet.relationships.length === 0) {
    // An empty array and an absent array are different: [] means the engine computed the set and it is empty, which is
    // a real answer; undefined means it did not tell us.
    if (planet.relationships !== undefined) {
      return <td data-state="value">{t('kundali.planets.none')}</td>;
    }
    return (
      <Cell
        view={resolveCell(planet, 'relationships', undefined)}
        column={t('kundali.planets.column.relationships')}
      >
        {() => null}
      </Cell>
    );
  }

  return (
    <td data-state="value">
      <ul className={styles.chipList}>
        {planet.relationships.map((code) => (
          <li key={code} className={styles.chip}>
            {relationshipLabel(translator, code)}
          </li>
        ))}
      </ul>
    </td>
  );
}

function AspectsCell({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();
  const translator = useTranslator();

  if (planet.aspects === undefined) {
    return (
      <Cell view={resolveCell(planet, 'aspects', undefined)} column={t('kundali.planets.column.aspects')}>
        {() => null}
      </Cell>
    );
  }

  if (planet.aspects.length === 0) {
    return <td data-state="value">{t('kundali.planets.noAspects')}</td>;
  }

  return (
    <td data-state="value">
      <ul className={styles.aspectList}>
        {planet.aspects.map((aspect) => (
          <li key={`${aspect.to}-${aspect.type}`} className={styles.aspect}>
            {aspect.orb === undefined
              ? t('kundali.planets.aspectNoOrb', {
                  to: planetLabel(translator, aspect.to),
                  type: aspectTypeLabel(translator, aspect.type),
                })
              : t('kundali.planets.aspect', {
                  to: planetLabel(translator, aspect.to),
                  type: aspectTypeLabel(translator, aspect.type),
                  orb: aspect.orb,
                })}
          </li>
        ))}
      </ul>
    </td>
  );
}

/**
 * One row of the planetary table.
 *
 * The row is always present for a planet the payload lists. Suppressing a planet because its data is incomplete would
 * make the chart look like it has fewer planets than it does, which reads as a fact.
 */
export function PlanetRow({ planet }: { planet: PlanetDetail }) {
  const { t } = useTranslation();
  const translator = useTranslator();

  return (
    <tr data-testid={`planet-row-${planet.planet}`}>
      <th scope="row" className={styles.rowHeader}>
        {planetLabel(translator, planet.planet)}
      </th>
      <PositionCells planet={planet} />
      <NakshatraCell planet={planet} />
      <Cell view={resolveCell(planet, 'house', planet.house)} column={t('kundali.planets.column.house')}>
        {(house) => t('kundali.planets.houseValue', { house })}
      </Cell>
      <DignityCell planet={planet} />
      <FlagCells planet={planet} />
      <RelationshipsCell planet={planet} />
      <AspectsCell planet={planet} />
    </tr>
  );
}
