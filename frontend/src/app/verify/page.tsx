'use client';

// Public certificate verification entry (Sprint 5 — FR-CAND-091).
// Accepts a certificate number and forwards to the public result page.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, PageHeader, Panel, TextInput } from '@/components/ui';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';

export default function VerifyPage() {
  const router = useRouter();
  const [value, setValue] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    router.push(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
        <PageHeader
          title="Verify a certificate"
          subtitle="Enter a certificate number to confirm its status. Verification is public and does not require an account."
        />
        <Panel>
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Certificate number"
              htmlFor="certificate-number"
              hint="Printed on the certificate, formatted like IP-2026-XXXXXXXXX"
            >
              <TextInput
                id="certificate-number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="IP-2026-…"
                autoComplete="off"
                required
              />
            </Field>
            {/* Disabled until there is something to verify — an empty submit
                was previously a silent no-op with no feedback. */}
            <div>
              <Button type="submit" disabled={value.trim().length === 0}>
                Verify
              </Button>
            </div>
          </form>
        </Panel>
      </main>
      <PublicFooter />
    </div>
  );
}
