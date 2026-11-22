// Authenticated route-boundary loading state: the shared branded loading
// experience (components/brand-loader.tsx) replaces the bare spinner while a
// page inside the app shell suspends during navigation or a direct URL load.
// One branded experience for the whole app — the same logo, animation,
// typography and colours as the first-visit welcome gate.
import { BrandLoader } from '@/components/brand-loader';

export default function AppLoading() {
  return <BrandLoader hint="Loading your workspace…" />;
}
