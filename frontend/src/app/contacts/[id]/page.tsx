'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Plus,
  Check,
  Bell,
  MessageSquare,
  Send,
  Inbox,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  useContact,
  useContactEmails,
  useContactAISummary,
  useContactRecommendations,
  useContactReminders,
  useRegenerateAISummary
} from '@/hooks/use-contacts';
import { cn } from '@/lib/utils';
import type { ContactEmail, AIRecommendation, ContactReminder } from '@/lib/api/services/contacts.service';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const { data: contact, isLoading: contactLoading } = useContact(contactId);
  const { data: emails, isLoading: emailsLoading } = useContactEmails(contactId);
  const { data: aiSummary, isLoading: summaryLoading } = useContactAISummary(contactId);
  const { data: recommendations, isLoading: recsLoading } = useContactRecommendations(contactId);
  const { data: reminders, isLoading: remindersLoading } = useContactReminders(contactId);
  const regenerateSummary = useRegenerateAISummary();

  const [activeTab, setActiveTab] = useState('timeline');

  if (contactLoading) {
    return <ContactDetailSkeleton />;
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Contact not found</h2>
        <Button onClick={() => router.push('/contacts')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/contacts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              {contact.position && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {contact.position}
                </span>
              )}
              {contact.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {contact.company}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {contact.email && (
            <Button variant="outline" asChild>
              <a href={`mailto:${contact.email}`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </a>
            </Button>
          )}
          {contact.phone && (
            <Button variant="outline" asChild>
              <a href={`tel:${contact.phone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Contact Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {contact.email && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{contact.email}</p>
              </div>
            )}
            {contact.phone && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{contact.phone}</p>
              </div>
            )}
            {contact.lastContactedAt && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last Contact</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(contact.lastContactedAt), { addSuffix: true })}
                </p>
              </div>
            )}
            {contact.tags && contact.tags.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Email Timeline & AI Summary */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Timeline
              </TabsTrigger>
              <TabsTrigger value="ai-summary" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <EmailTimeline
                emails={emails?.data || []}
                isLoading={emailsLoading}
                total={emails?.total || 0}
                hasMore={emails?.hasMore || false}
              />
            </TabsContent>

            <TabsContent value="ai-summary" className="mt-4">
              <AISummaryCard
                summary={aiSummary}
                isLoading={summaryLoading}
                onRegenerate={() => regenerateSummary.mutate(contactId)}
                isRegenerating={regenerateSummary.isPending}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Recommendations & Reminders */}
        <div className="space-y-6">
          {/* AI Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  AI Recommendations
                </CardTitle>
              </div>
              <CardDescription>Suggested next steps</CardDescription>
            </CardHeader>
            <CardContent>
              {recsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.recommendations.map((rec, idx) => (
                    <RecommendationItem key={idx} recommendation={rec} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recommendations available yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  Reminders
                </CardTitle>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : reminders && reminders.length > 0 ? (
                <div className="space-y-2">
                  {reminders.map((reminder) => (
                    <ReminderItem key={reminder.id} reminder={reminder} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No reminders set
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Email Timeline Component
function EmailTimeline({
  emails,
  isLoading,
  total,
  hasMore
}: {
  emails: ContactEmail[];
  isLoading: boolean;
  total: number;
  hasMore: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No email history</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Gmail to see email communication history
            </p>
            <Button className="mt-4" variant="outline" asChild>
              <a href="/settings/integrations">Connect Gmail</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{total} Emails</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {emails.map((email) => (
              <EmailItem key={email.id} email={email} />
            ))}
            {hasMore && (
              <Button variant="ghost" className="w-full">
                Load more emails
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Email Item Component
function EmailItem({ email }: { email: ContactEmail }) {
  const isOutbound = email.direction === 'OUTBOUND';

  return (
    <div className={cn(
      "flex gap-3 p-3 rounded-lg border",
      isOutbound ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-muted/30"
    )}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        isOutbound ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
      )}>
        {isOutbound ? <Send className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm truncate">
            {email.subject || '(no subject)'}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(email.occurredAt), 'MMM d, yyyy')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {email.snippet}
        </p>
      </div>
    </div>
  );
}

// AI Summary Card Component
function AISummaryCard({
  summary,
  isLoading,
  onRegenerate,
  isRegenerating
}: {
  summary: any;
  isLoading: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full mt-4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse the summary content if it's JSON
  let parsedSummary: any = null;
  try {
    if (summary?.content && summary.content.startsWith('{')) {
      parsedSummary = JSON.parse(summary.content);
    }
  } catch (e) {
    // Content is plain text
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Communication Summary</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Regenerate
          </Button>
        </div>
        {summary && (
          <CardDescription>
            Based on {summary.emailsIncluded} emails
            {summary.isCached && ' • Cached'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!summary || summary.content === 'No email communication history available yet.' ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No summary available</h3>
            <p className="text-sm text-muted-foreground">
              Connect Gmail to generate AI-powered communication summaries
            </p>
          </div>
        ) : parsedSummary ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Overview</h4>
              <p className="text-sm text-muted-foreground">{parsedSummary.summary}</p>
            </div>

            {parsedSummary.topics && parsedSummary.topics.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Key Topics</h4>
                <div className="space-y-2">
                  {parsedSummary.topics.map((topic: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm">{topic.topic}</span>
                      <Badge variant={
                        topic.status === 'resolved' ? 'default' :
                        topic.status === 'needs_attention' ? 'destructive' : 'secondary'
                      }>
                        {topic.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedSummary.relationshipStrength && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Relationship:</span>
                <Badge variant={
                  parsedSummary.relationshipStrength === 'strong' ? 'default' :
                  parsedSummary.relationshipStrength === 'moderate' ? 'secondary' : 'outline'
                }>
                  {parsedSummary.relationshipStrength}
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{summary.content}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Recommendation Item Component
function RecommendationItem({ recommendation }: { recommendation: AIRecommendation }) {
  const priorityColors = {
    high: 'text-red-600 bg-red-100',
    medium: 'text-amber-600 bg-amber-100',
    low: 'text-green-600 bg-green-100',
  };

  const categoryIcons = {
    follow_up: MessageSquare,
    meeting: Calendar,
    email: Mail,
    call: Phone,
    other: ChevronRight,
  };

  const Icon = categoryIcons[recommendation.category] || ChevronRight;

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          priorityColors[recommendation.priority]
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{recommendation.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {recommendation.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Reminder Item Component
function ReminderItem({ reminder }: { reminder: ContactReminder }) {
  const isCompleted = reminder.status === 'COMPLETED';
  const isOverdue = !isCompleted && new Date(reminder.scheduledFor) < new Date();

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg",
      isCompleted && "opacity-60",
      isOverdue && "bg-red-50 dark:bg-red-950/20"
    )}>
      <Button
        size="icon"
        variant={isCompleted ? "default" : "outline"}
        className="h-6 w-6 shrink-0"
      >
        {isCompleted ? (
          <Check className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
      </Button>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          isCompleted && "line-through"
        )}>
          {reminder.title}
        </p>
        <p className={cn(
          "text-xs",
          isOverdue ? "text-red-600" : "text-muted-foreground"
        )}>
          {format(new Date(reminder.scheduledFor), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );
}

// Skeleton for loading state
function ContactDetailSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-[600px] w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}









