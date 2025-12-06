'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useGoogleOAuthCallback } from '@/hooks';

/**
 * Google OAuth Callback Page
 * Handles the OAuth callback from Google
 *
 * Note: This page is NOT protected because the OAuth callback happens
 * mid-flow before the integration is established. The backend validates
 * the state parameter to ensure the request is legitimate.
 */

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const callbackMutation = useGoogleOAuthCallback();

  // Get stored orgSlug for redirect after OAuth
  const getRedirectUrl = (path: string) => {
    if (typeof window === 'undefined') return path;
    const orgSlug = localStorage.getItem('oauth_redirect_org');
    // Clean up after use
    localStorage.removeItem('oauth_redirect_org');
    return orgSlug ? `/${orgSlug}${path}` : path;
  };

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      // Check for OAuth errors
      if (errorParam) {
        setError(`OAuth error: ${errorParam}`);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError('Missing required OAuth parameters');
        return;
      }

      try {
        await callbackMutation.mutateAsync({ code, state });

        // Success - redirect to integrations page with success message
        setTimeout(() => {
          router.push(getRedirectUrl('/settings/integrations?success=google-connected'));
        }, 1500);
      } catch (err: any) {
        setError(err?.message || 'Failed to connect Google account');
      }
    };

    handleCallback();
  }, [searchParams, callbackMutation, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {error ? (
          // Error State
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Connection Failed
            </h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <button
              onClick={() => {
                const orgSlug = typeof window !== 'undefined' ? localStorage.getItem('oauth_redirect_org') : null;
                localStorage.removeItem('oauth_redirect_org');
                router.push(orgSlug ? `/${orgSlug}/settings/integrations` : '/settings/integrations');
              }}
              className="mt-6 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Back to Integrations
            </button>
          </div>
        ) : callbackMutation.isSuccess ? (
          // Success State
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Google Account Connected!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Redirecting you to integrations...
            </p>
          </div>
        ) : (
          // Loading State
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Connecting Google Account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we complete the connection...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleCallbackFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Loading...
          </h2>
        </div>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<GoogleCallbackFallback />}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
