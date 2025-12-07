'use client';

import { useState } from 'react';

interface IntegrationPromptProps {
  onNext: (data?: Record<string, unknown>) => void;
  onBack: () => void;
  onSkip: () => void;
  showBack: boolean;
  // Accept but ignore these props from parent
  workspaceData?: Record<string, unknown> | null;
  profileData?: Record<string, unknown> | null;
}

const AVAILABLE_INTEGRATIONS = [
  {
    id: 'google',
    name: 'Google Contacts',
    description: 'Sync your Google contacts and calendar',
    comingSoon: false,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365',
    description: 'Connect Outlook contacts and calendar',
    comingSoon: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 23 23">
        <path fill="#f3f3f3" d="M0 0h23v23H0z" />
        <path fill="#f35325" d="M1 1h10v10H1z" />
        <path fill="#81bc06" d="M12 1h10v10H12z" />
        <path fill="#05a6f0" d="M1 12h10v10H1z" />
        <path fill="#ffba08" d="M12 12h10v10H12z" />
      </svg>
    ),
  },
];

export function IntegrationPrompt({ onNext, onBack, onSkip, showBack }: IntegrationPromptProps) {
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (integrationId: string) => {
    setConnecting(integrationId);
    // In a real app, this would initiate OAuth flow
    setTimeout(() => {
      setConnecting(null);
      onNext();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-gray-600">
          Connect your favorite tools to automatically sync contacts and calendar events.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          You can skip this step and connect integrations later.
        </p>
      </div>

      <div className="space-y-4">
        {AVAILABLE_INTEGRATIONS.map((integration) => (
          <div
            key={integration.id}
            className={`border border-gray-200 rounded-lg p-6 transition-colors ${
              integration.comingSoon ? 'opacity-75' : 'hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex-shrink-0 ${integration.comingSoon ? 'grayscale' : ''}`}>
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    {integration.comingSoon && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{integration.description}</p>
                </div>
              </div>
              {integration.comingSoon ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
                >
                  Coming Soon
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnect(integration.id)}
                  disabled={connecting === integration.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {connecting === integration.id ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg
            className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="font-medium text-blue-900">Why connect integrations?</h4>
            <p className="text-sm text-blue-700 mt-1">
              Automatically sync your existing contacts, track interactions, and never miss important
              follow-ups. Your data is encrypted and secure.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        )}
        <div className="flex gap-3 ml-auto">
          <button
            type="button"
            onClick={onSkip}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}
