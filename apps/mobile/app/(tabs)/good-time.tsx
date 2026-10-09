import { useLocalSearchParams } from 'expo-router';

import { GoodTimeScreen as GoodTime } from '../../src/features/good-time/GoodTimeScreen';
import { Screen } from '../../src/shared/components';

/** Find a Good Time. `?activity=` presets the activity (e.g. from a link); General otherwise. */
export default function GoodTimeScreen() {
  const { activity } = useLocalSearchParams<{ activity?: string }>();
  return (
    <Screen>
      <GoodTime initialActivity={activity} />
    </Screen>
  );
}
