'use client';

import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/ui/skeletons';
import { Sparkles, ChevronRight, X, Clock, ThumbsUp, ThumbsDown, UserCircle } from 'lucide-react';
import {
  useRecommendations,
  useDismissRecommendation,
  useSnoozeRecommendation,
  useFeedbackRecommendation,
} from '@/hooks';
import { cn } from '@/lib/utils';

export const AIRecommendationsWidget: React.FC = () => {
  const { data: recommendations, isLoading } = useRecommendations({ period: 'daily', limit: 5 });
  const dismiss = useDismissRecommendation();
  const snooze = useSnoozeRecommendation();
  const feedback = useFeedbackRecommendation();
  const [feedbackGiven, setFeedbackGiven] = React.useState<Set<string>>(new Set());

  const handleDismiss = async (id: string, contactName: string) => {
    try {
      await dismiss.mutateAsync(id);
      toast.info('Recommendation dismissed', {
        description: `Removed suggestion for ${contactName}`,
      });
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
      toast.error('Failed to dismiss', {
        description: 'Please try again',
      });
    }
  };

  const handleSnooze = async (id: string, contactName: string) => {
    try {
      await snooze.mutateAsync({ recommendationId: id, days: 7 });
      toast.success('Snoozed for 7 days', {
        description: `Recommendation for ${contactName} postponed`,
      });
    } catch (error) {
      console.error('Failed to snooze recommendation:', error);
      toast.error('Failed to snooze', {
        description: 'Please try again',
      });
    }
  };

  const handleFeedback = async (id: string, isHelpful: boolean) => {
    try {
      await feedback.mutateAsync({ recommendationId: id, isHelpful });
      setFeedbackGiven((prev) => new Set(prev).add(id));
      toast.success('Thanks for your feedback!', {
        description: isHelpful
          ? 'We\'ll show you more like this'
          : 'We\'ll improve our suggestions',
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback', {
        description: 'Please try again',
      });
    }
  };

  const getUrgencyBadge = (score: number) => {
    if (score >= 80) {
      return <Badge variant="destructive">High Priority</Badge>;
    }
    if (score >= 60) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          Medium
        </Badge>
      );
    }
    return <Badge variant="secondary">Low</Badge>;
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ListSkeleton items={3} />
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
              <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="font-medium text-foreground mb-1">No recommendations yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your integrations to get personalized suggestions
            </p>
            <Link href="/settings/integrations">
              <Button variant="outline" size="sm">
                Connect Integrations
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Recommendations
          </CardTitle>
          <Badge variant="secondary">{recommendations.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={rec.id}
              className={cn(
                'group p-4 rounded-lg border border-border',
                'bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/30',
                'hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-200',
                'animate-in fade-in slide-in-from-right-2'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                    <UserCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/contacts/${rec.contact.id}`}
                      className="font-medium text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      {rec.contact.firstName} {rec.contact.lastName}
                    </Link>
                    {rec.contact.company && (
                      <p className="text-sm text-muted-foreground">
                        {rec.contact.company}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {getUrgencyBadge(rec.urgencyScore)}
                </div>
              </div>

              <div className="ml-13 pl-13">
                <Badge variant="outline" className="text-xs mb-2">
                  {getTriggerLabel(rec.triggerType)}
                </Badge>
                <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {!feedbackGiven.has(rec.id) ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFeedback(rec.id, true)}
                          className="h-7 gap-1 text-green-600 hover:text-green-700 dark:text-green-400"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          Helpful
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFeedback(rec.id, false)}
                          className="h-7 gap-1 text-muted-foreground"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        Thanks for feedback!
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleSnooze(
                          rec.id,
                          `${rec.contact.firstName} ${rec.contact.lastName}`
                        )
                      }
                      disabled={snooze.isPending}
                      className="h-7 w-7"
                      title="Snooze 7 days"
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleDismiss(
                          rec.id,
                          `${rec.contact.firstName} ${rec.contact.lastName}`
                        )
                      }
                      disabled={dismiss.isPending}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Link href="/recommendations">
          <Button variant="ghost" className="w-full mt-4 gap-2">
            View all recommendations
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
