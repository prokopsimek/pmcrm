'use client';

import { IcebreakerDialog } from '@/components/ai';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout';
import { NotesPanel } from '@/components/notes';
import { UnifiedTimeline } from '@/components/timeline';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useContact,
    useContactAISummary,
    useContactRecommendations,
    useContactReminders,
    useRegenerateAISummary
} from '@/hooks/use-contacts';
import { useContactNotes, useNoteActions } from '@/hooks/use-notes';
import type { AIRecommendation, ContactReminder } from '@/lib/api/services/contacts.service';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
    AlertCircle,
    ArrowLeft,
    Bell,
    Briefcase,
    Building2,
    Calendar,
    Check,
    ChevronRight,
    Clock,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    Plus,
    RefreshCw,
    Sparkles,
    Wand2
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const orgSlug = params.orgSlug as string;

  const { data: contact, isLoading: contactLoading } = useContact(contactId);
  const { data: aiSummary, isLoading: summaryLoading } = useContactAISummary(contactId);
  const { data: recommendations, isLoading: recsLoading } = useContactRecommendations(contactId);
  const { data: reminders, isLoading: remindersLoading } = useContactReminders(contactId);
  const regenerateSummary = useRegenerateAISummary();

  // Notes hooks
  const { data: notesData, isLoading: notesLoading } = useContactNotes(contactId);
  const { createNote, updateNote, deleteNote, togglePin, isCreating } = useNoteActions(contactId);
  const [updatingNoteId, setUpdatingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('ai-summary');
  const [icebreakerDialogOpen, setIcebreakerDialogOpen] = useState(false);

  // Note action handlers
  const handleCreateNote = (content: string) => {
    createNote.mutate({ content });
  };

  const handleUpdateNote = (noteId: string, content: string) => {
    setUpdatingNoteId(noteId);
    updateNote.mutate(
      { noteId, data: { content } },
      { onSettled: () => setUpdatingNoteId(null) }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    setDeletingNoteId(noteId);
    deleteNote.mutate(noteId, { onSettled: () => setDeletingNoteId(null) });
  };

  const handleTogglePin = (noteId: string) => {
    togglePin.mutate(noteId);
  };

  // Helper to create org-prefixed links
  const orgLink = (path: string) => `/${orgSlug}${path}`;

  if (contactLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <ContactDetailSkeleton />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!contact) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Contact not found</h2>
            <Button onClick={() => router.push(orgLink('/contacts'))}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Button>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(orgLink('/contacts'))}>
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
          <Button
            variant="default"
            onClick={() => setIcebreakerDialogOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Message
          </Button>
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

      {/* AI Icebreaker Dialog */}
      <IcebreakerDialog
        open={icebreakerDialogOpen}
        onOpenChange={setIcebreakerDialogOpen}
        contact={{
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          company: contact.company,
          position: contact.position,
        }}
      />

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
        {/* Left Column - Timeline & AI Summary */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ai-summary" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Summary
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai-summary" className="mt-4">
              <AISummaryCard
                summary={aiSummary}
                importance={contact?.importance}
                isLoading={summaryLoading}
                onRegenerate={() => regenerateSummary.mutate(contactId)}
                isRegenerating={regenerateSummary.isPending}
              />
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <UnifiedTimeline contactId={contactId} orgSlug={orgSlug} />
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

          {/* Notes */}
          <NotesPanel
            contactId={contactId}
            notes={notesData?.data || []}
            isLoading={notesLoading}
            onCreateNote={handleCreateNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onTogglePin={handleTogglePin}
            isCreating={isCreating}
            updatingNoteId={updatingNoteId}
            deletingNoteId={deletingNoteId}
          />
        </div>
      </div>
    </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// Helper function to get relationship label from importance score
function getRelationshipLabel(importance: number | undefined) {
  if (importance === undefined || importance < 20) {
    return { label: 'New', variant: 'outline' as const };
  }
  if (importance >= 80) {
    return { label: 'Strong', variant: 'default' as const };
  }
  if (importance >= 50) {
    return { label: 'Moderate', variant: 'secondary' as const };
  }
  return { label: 'Weak', variant: 'outline' as const };
}

// AI Summary Card Component
function AISummaryCard({
  summary,
  importance,
  isLoading,
  onRegenerate,
  isRegenerating
}: {
  summary: any;
  importance?: number;
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

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Relationship:</span>
              {(() => {
                const rel = getRelationshipLabel(importance);
                return (
                  <Badge variant={rel.variant}>
                    {rel.label}
                    {importance !== undefined && ` (${importance})`}
                  </Badge>
                );
              })()}
            </div>
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

