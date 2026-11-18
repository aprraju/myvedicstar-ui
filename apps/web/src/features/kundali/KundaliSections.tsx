import { useTranslation } from '../../shared/i18n/I18nProvider';
import { AshtakavargaSection } from './ashtakavarga/AshtakavargaSection';
import { useAshtakavarga } from './ashtakavarga/useAshtakavarga';
import { AssessmentHost } from './assessment/AssessmentHost';
import styles from './Kundali.module.css';
import { useYogas } from './yogas/useYogas';
import { YogasSection } from './yogas/YogasSection';

/**
 * The assessment body of the Kundali route for one selected Astro Profile (KUN-10, KUN-11).
 *
 * Each section loads independently, so one unavailable or failing section never blanks the others: the yogas request
 * failing says nothing about Ashtakavarga. Availability is per section and comes from the server; the page decides
 * nothing about which sections should exist.
 *
 * The timezone is the profile's own, used only to render transit reference instants - never to convert calculation
 * input.
 */
export function KundaliSections({ profileId, timeZoneId }: { profileId: string; timeZoneId: string }) {
  const { t } = useTranslation();
  const yogas = useYogas(profileId);
  const ashtakavarga = useAshtakavarga(profileId);

  return (
    <div className={styles.sections}>
      <AssessmentHost
        title={t('kundali.yogas.title')}
        status={yogas.status}
        data={yogas.yogas}
        errorKind={yogas.errorKind}
        reload={yogas.reload}
      >
        {(data) => <YogasSection yogas={data} timeZoneId={timeZoneId} />}
      </AssessmentHost>

      <AssessmentHost
        title={t('kundali.ashtakavarga.title')}
        status={ashtakavarga.status}
        data={ashtakavarga.ashtakavarga}
        errorKind={ashtakavarga.errorKind}
        reload={ashtakavarga.reload}
      >
        {(data) => <AshtakavargaSection ashtakavarga={data} />}
      </AssessmentHost>
    </div>
  );
}
