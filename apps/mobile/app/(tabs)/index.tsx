import { TodayDashboard } from '../../src/features/dashboard/TodayDashboard';
import { PublicTodayScreen } from '../../src/features/home/PublicTodayScreen';
import { useAuth } from '../../src/shared/auth';

/** Today: the mobile dashboard for signed-in users, or the public landing page for visitors. */
export default function TodayScreen() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <TodayDashboard /> : <PublicTodayScreen />;
}
