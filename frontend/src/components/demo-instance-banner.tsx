// Hosted-demonstration notice (deployment sprint 2026-11-22).
//
// Rendered on every page ONLY when NEXT_PUBLIC_DEMO_INSTANCE is exactly 'true'
// (set in the Vercel project for the academic demonstration deployment). It is
// a static, server-rendered strip: no credentials, no links, no client state.
// Local development and any future real deployment leave the variable unset,
// so nothing is shown there.

export const demoInstance = process.env.NEXT_PUBLIC_DEMO_INSTANCE === 'true';

export function DemoInstanceBanner() {
  if (!demoInstance) return null;
  return (
    <div
      role="note"
      aria-label="Demonstration notice"
      className="border-b border-wine-200 bg-wine-50 px-4 py-2 text-center text-xs leading-snug text-wine-700 sm:text-sm"
    >
      <strong className="font-semibold">InternPath Demonstration</strong>
      <span aria-hidden="true"> — </span>
      <span className="sr-only">: </span>
      This instance is for academic demonstration. Internship opportunities are
      not open for real applications.
    </div>
  );
}
