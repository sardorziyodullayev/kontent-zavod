import { createHashHistory, createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { NarxtopRoute, Shell } from './components/shell';
import { videoSearch } from './pages/videos-search';

// Admin sahifalari alohida fayllarda (lazy): ish beruvchi faqat Narxtop va qobiqni yuklaydi.
// Narxtop sahifasi asosiy faylda — mijoz uchun tez ochilsin.
const root = createRootRoute({ component: Shell });
const r = (path: string, component: ReturnType<typeof lazyRouteComponent> | (() => React.ReactNode)) => createRoute({ getParentRoute: () => root, path, component });

const routeTree = root.addChildren([
  r('/', lazyRouteComponent(() => import('./pages/dashboard'), 'DashboardPage')),
  createRoute({ getParentRoute: () => root, path: '/videolar', component: lazyRouteComponent(() => import('./pages/videos'), 'VideosPage'), validateSearch: videoSearch }),
  r('/reja', lazyRouteComponent(() => import('./pages/calendar'), 'CalendarPage')),
  r('/ssenariylar', lazyRouteComponent(() => import('./pages/scripts'), 'ScriptsPage')),
  r('/tahlil', lazyRouteComponent(() => import('./pages/analytics'), 'AnalyticsPage')),
  r('/platformalar', lazyRouteComponent(() => import('./pages/platforms'), 'PlatformsPage')),
  r('/konveyer', lazyRouteComponent(() => import('./pages/factory'), 'FactoryPage')),
  r('/sozlamalar', lazyRouteComponent(() => import('./pages/settings'), 'SettingsPage')),
  r('/narxtop', NarxtopRoute),
]);

// Hash tarix: GitHub Pages kabi statik hostingda ham sahifalar ishlaydi.
export const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
