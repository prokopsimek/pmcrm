'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout';
import { ContactImportWizard } from '@/components/integrations/ContactImportWizard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

/**
 * Google Contacts Import Page
 * Full-page wizard for importing contacts from Google
 */
function GoogleImportPageContent() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const handleSuccess = () => {
    router.push(`/${orgSlug}/contacts`);
  };

  const handleCancel = () => {
    router.push(`/${orgSlug}/settings/integrations`);
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="min-h-[calc(100vh-4rem)] flex flex-col">
          {/* Breadcrumb Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container max-w-6xl mx-auto px-4 py-4">
              <Link
                href={`/${orgSlug}/settings/integrations`}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Integrations
              </Link>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 container max-w-6xl mx-auto px-4 py-8">
            <ContactImportWizard
              provider="google"
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

/**
 * Loading fallback for Suspense
 */
function LoadingFallback() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading import wizard...</p>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function GoogleImportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GoogleImportPageContent />
    </Suspense>
  );
}







