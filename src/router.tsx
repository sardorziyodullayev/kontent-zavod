import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Shell } from './components/shell';
import { AnalyticsPage } from './pages/analytics';
import { CalendarPage } from './pages/calendar';
import { DashboardPage } from './pages/dashboard';
import { FactoryPage } from './pages/factory';
import { PlatformsPage } from './pages/platforms';
import { ScriptsPage } from './pages/scripts';
import { SettingsPage } from './pages/settings';
import { VideosPage, videoSearch } from './pages/videos';

const root = createRootRoute({ component: Shell });
const r = (path: string, component: () => React.ReactNode) => createRoute({ getParentRoute: () => root, path, component });

const routeTree = root.addChildren([
  r('/', DashboardPage),
  createRoute({ getParentRoute: () => root, path: '/videolar', component: VideosPage, validateSearch: videoSearch }),
  r('/reja', CalendarPage),
  r('/ssenariylar', ScriptsPage),
  r('/tahlil', AnalyticsPage),
  r('/platformalar', PlatformsPage),
  r('/konveyer', FactoryPage),
  r('/sozlamalar', SettingsPage),
]);

// Hash tarix: GitHub Pages kabi statik hostingda ham sahifalar ishlaydi.
export const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
