'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkspaceSetup } from '@/components/onboarding/WorkspaceSetup';
import { ProfileSetup } from '@/components/onboarding/ProfileSetup';
import { IntegrationPrompt } from '@/components/onboarding/IntegrationPrompt';
import { ImportContacts } from '@/components/onboarding/ImportContacts';
import { Complete } from '@/components/onboarding/Complete';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Briefcase, User, Link2, Upload, Sparkles, Loader2 } from 'lucide-react';

const ONBOARDING_STEPS = [
  { id: 'workspace', title: 'Workspace', icon: Briefcase, component: WorkspaceSetup },
  { id: 'profile', title: 'Profile', icon: User, component: ProfileSetup },
  { id: 'integrations', title: 'Integrations', icon: Link2, component: IntegrationPrompt },
  { id: 'import', title: 'Import', icon: Upload, component: ImportContacts },
  { id: 'complete', title: 'Complete', icon: Sparkles, component: Complete },
];

/**
 * Onboarding Wizard Content
 * Contains the main logic that uses useSearchParams
 */
function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [workspaceData, setWorkspaceData] = useState<Record<string, unknown> | null>(null);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);

  // Handle OAuth callback tokens
  const accessToken = searchParams.get('accessToken');
  const refreshToken = searchParams.get('refreshToken');

  if (accessToken && refreshToken) {
    // Store tokens from OAuth callback
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      // Clean up URL
      window.history.replaceState({}, '', '/onboarding');
    }
  }

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const CurrentComponent = currentStepData.component;
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  const handleNext = async (data?: Record<string, unknown>) => {
    // Save step data
    if (currentStep === 0) setWorkspaceData(data || null);
    if (currentStep === 1) setProfileData(data || null);

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Onboarding complete, redirect to dashboard
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Logo & Title */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Welcome to Personal CRM
          </h1>
          <p className="text-muted-foreground">
            Let&apos;s get you set up in just a few steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="relative mb-8 animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted mx-12" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 mx-12"
            style={{ width: `calc(${progress - 20}% - 3rem)` }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {ONBOARDING_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center"
                >
                  <div
                    className={cn(
                      'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                      isCompleted && 'border-primary bg-primary text-primary-foreground',
                      isCurrent && 'border-primary bg-background ring-4 ring-primary/20',
                      !isCompleted && !isCurrent && 'border-muted bg-background text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium transition-colors',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">{currentStepData.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
              </p>
            </div>

            <CurrentComponent
              onNext={handleNext}
              onBack={handleBack}
              onSkip={handleSkip}
              showBack={currentStep > 0}
              workspaceData={workspaceData}
              profileData={profileData}
            />
          </CardContent>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-muted-foreground mt-6 animate-in fade-in duration-500 delay-300">
          Need help? Check out our{' '}
          <a href="/docs" className="text-primary hover:underline">
            documentation
          </a>{' '}
          or{' '}
          <a href="/support" className="text-primary hover:underline">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Loading fallback for Suspense
 */
function OnboardingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Onboarding Wizard Page
 * Guides new users through setup process
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent />
    </Suspense>
  );
}
