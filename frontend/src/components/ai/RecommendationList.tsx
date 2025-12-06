'use client';

/**
 * Recommendation List Component
 * Displays a list of AI recommendations
 */
import React from 'react';
import { RecommendationCard } from './RecommendationCard';
import type { Recommendation } from '@/types/dashboard';

interface RecommendationListProps {
  recommendations: Recommendation[];
  onDismiss: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onFeedback: (id: string, isHelpful: boolean) => void;
}

export const RecommendationList: React.FC<RecommendationListProps> = ({
  recommendations,
  onDismiss,
  onSnooze,
  onFeedback,
}) => {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Recommendations</h3>
        <p className="text-gray-600">
          You're all caught up! We'll notify you when there are new recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          onDismiss={onDismiss}
          onSnooze={onSnooze}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
};
