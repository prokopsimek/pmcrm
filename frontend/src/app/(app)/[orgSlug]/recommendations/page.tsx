'use client';

/**
 * Recommendations Page
 * Main page for displaying AI-powered contact recommendations
 * US-050: AI recommendations 'who to reach out'
 */
import React from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout';
import { RecommendationList } from '@/components/ai/RecommendationList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useRecommendations, useDismissRecommendation, useSnoozeRecommendation, useFeedbackRecommendation } from '@/hooks/use-dashboard';
import { useState } from 'react';

export default function RecommendationsPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const { data, isLoading, refetch } = useRecommendations({ period });
  const dismissMutation = useDismissRecommendation();
  const snoozeMutation = useSnoozeRecommendation();
  const feedbackMutation = useFeedbackRecommendation();

  const recommendations = data || [];

  const handleDismiss = async (id: string) => {
    await dismissMutation.mutateAsync(id);
  };

  const handleSnooze = async (id: string, days: number) => {
    await snoozeMutation.mutateAsync({ recommendationId: id, days });
  };

  const handleFeedback = async (id: string, isHelpful: boolean) => {
    await feedbackMutation.mutateAsync({ recommendationId: id, isHelpful });
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Recommendations</h1>
                <p className="text-muted-foreground">Smart suggestions on who to reach out to</p>
              </div>
            </div>
            <Button
              onClick={() => refetch()}
              disabled={isLoading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Tabs value={period} onValueChange={(v) => setPeriod(v as 'daily' | 'weekly')}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No Recommendations</h3>
              <p className="text-muted-foreground">You're all caught up! We'll notify you when there are new recommendations.</p>
            </div>
          ) : (
            <RecommendationList
              recommendations={recommendations}
              onDismiss={handleDismiss}
              onSnooze={handleSnooze}
              onFeedback={handleFeedback}
            />
          )}

          {!isLoading && recommendations.length > 0 && (
            <div className="p-4 bg-muted/50 border rounded-lg">
              <h3 className="font-medium mb-2">How recommendations work</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Recommendations are ranked by urgency and relationship strength</li>
                <li>• Job changes and company news are given higher priority</li>
                <li>• Your feedback helps improve future recommendations</li>
                <li>• Snoozed recommendations will reappear after the selected period</li>
              </ul>
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}











