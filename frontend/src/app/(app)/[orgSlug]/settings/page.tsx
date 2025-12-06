'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { LoadingPage } from '@/components/ui/loading-page';

/**
 * Settings Page - Redirects to Integrations
 * The main settings landing page redirects to the integrations settings.
 */
export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  useEffect(() => {
    router.replace(`/${orgSlug}/settings/integrations`);
  }, [router, orgSlug]);

  return <LoadingPage message="Loading settings..." />;
}









