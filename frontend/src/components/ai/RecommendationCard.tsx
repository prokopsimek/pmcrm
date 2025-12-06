'use client';

/**
 * Recommendation Card Component
 * Displays a single AI recommendation with actions
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, X, Clock } from 'lucide-react';
import type { Recommendation } from '@/types/dashboard';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onFeedback: (id: string, isHelpful: boolean) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onDismiss,
  onSnooze,
  onFeedback,
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const handleFeedback = (isHelpful: boolean) => {
    onFeedback(recommendation.id, isHelpful);
    setFeedbackGiven(true);
  };

  const getUrgencyColor = (score: number): string => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTriggerLabel = (type: string): string => {
    const labels: Record<string, string> = {
      job_change: 'Job Change',
      company_news: 'Company News',
      birthday: 'Birthday',
      overdue: 'Overdue',
      general: 'General',
    };
    return labels[type] || type;
  };

  return (
    <Card className="mb-4 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">
              {recommendation.contact.firstName} {recommendation.contact.lastName}
            </CardTitle>
            {recommendation.contact.company && (
              <p className="text-sm text-gray-600 mt-1">{recommendation.contact.company}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getUrgencyColor(recommendation.urgencyScore)}>
              {recommendation.urgencyScore}
            </Badge>
            <Badge variant="outline">{getTriggerLabel(recommendation.triggerType)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 mb-4">{recommendation.reason}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {!feedbackGiven ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFeedback(true)}
                  className="gap-1"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Helpful
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFeedback(false)}
                  className="gap-1"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Not Helpful
                </Button>
              </>
            ) : (
              <span className="text-sm text-green-600">Thank you for your feedback!</span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSnooze(recommendation.id, 7)}
              className="gap-1"
            >
              <Clock className="h-4 w-4" />
              Snooze
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDismiss(recommendation.id)}
              className="gap-1 text-gray-500 hover:text-red-600"
            >
              <X className="h-4 w-4" />
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
