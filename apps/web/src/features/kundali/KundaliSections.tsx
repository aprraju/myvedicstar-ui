import { varshaphalState } from '@myvedicstar/contracts';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import { AshtakavargaSection } from './ashtakavarga/AshtakavargaSection';
import { useAshtakavarga } from './ashtakavarga/useAshtakavarga';
import { AssessmentHost } from './assessment/AssessmentHost';
import styles from './Kundali.module.css';
import { RemediesSection } from './remedies/RemediesSection';
import { useRemedies } from './remedies/useRemedies';
import { TransitsSection } from './transits/TransitsSection';
import { useTransits } from './transits/useTransits';
import { useVarshaphal } from './varshaphal/useVarshaphal';
import { VarshaphalSection } from './varshaphal/VarshaphalSection';
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
  const transits = useTransits(profileId);
  const remedies = useRemedies(profileId);
  // KUN-14: the engine has no Varshaphal yet. This section renders the server's capability gap by default; it becomes a
  // chart only if a payload reports `computed`, and nothing here can construct one (ui#123).
  const varshaphal = useVarshaphal(profileId);

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

      <AssessmentHost
        title={t('kundali.transits.title')}
        status={transits.status}
        data={transits.section}
        errorKind={transits.errorKind}
        reload={transits.reload}
      >
        {(data) => <TransitsSection section={data} timeZoneId={timeZoneId} />}
      </AssessmentHost>

      {/* KUN-16 is optional and collapsible: it loads like every other section, but renders closed so an optional
          practice list never displaces the assessment the user came for. */}
      <AssessmentHost
        title={t('kundali.remedies.title')}
        status={remedies.status}
        data={remedies.section}
        errorKind={remedies.errorKind}
        reload={remedies.reload}
      >
        {(data) => <RemediesSection section={data} />}
      </AssessmentHost>

      <AssessmentHost
        title={t('kundali.varshaphal.title')}
        status={varshaphal.status}
        data={varshaphal.response}
        errorKind={varshaphal.errorKind}
        reload={varshaphal.reload}
      >
        {(data) => <VarshaphalSection title={t('kundali.varshaphal.title')} state={varshaphalState(data)} />}
      </AssessmentHost>
    </div>
  );
}
