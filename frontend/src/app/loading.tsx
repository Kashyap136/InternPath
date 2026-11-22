// Root route-boundary loading state (public + auth routes): the shared
// branded loading experience (components/brand-loader.tsx) replaces the
// bare spinner while a route segment suspends during navigation or a
// direct URL load. The overlay is unmounted by Next.js as soon as the
// destination content is ready, so it never lingers after the page is
// usable, and it cannot mask errors (an error boundary replaces it).
import { BrandLoader } from '@/components/brand-loader';

export default function AppLoading() {
  return <BrandLoader hint="Loading…" />;
}
