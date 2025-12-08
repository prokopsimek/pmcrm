'use client';

/**
 * AI Icebreaker Dialog Component
 * US-051: AI icebreaker message generation
 * Modal for generating, selecting, and editing AI-powered icebreaker messages
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Linkedin,
  MessageCircle,
  Briefcase,
  Users,
  Coffee,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  useGenerateIcebreaker,
  useRegenerateIcebreaker,
  useSelectVariation,
  useSubmitIcebreakerFeedback,
  type IcebreakerChannel,
  type IcebreakerTone,
  type IcebreakerFeedback,
  type MessageVariation,
} from '@/hooks';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  company?: string;
  position?: string;
}

interface IcebreakerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  onCopyMessage?: (message: string, subject?: string) => void;
}

// Channel configuration
const CHANNELS: Array<{
  value: IcebreakerChannel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    value: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Formal message with subject line',
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    description: 'Short professional message (300 chars)',
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    description: 'Brief conversational message',
  },
];

// Tone configuration
const TONES: Array<{
  value: IcebreakerTone;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    value: 'professional',
    label: 'Professional',
    icon: Briefcase,
    description: 'Formal business tone',
  },
  {
    value: 'friendly',
    label: 'Friendly',
    icon: Users,
    description: 'Warm and approachable',
  },
  {
    value: 'casual',
    label: 'Casual',
    icon: Coffee,
    description: 'Relaxed and personable',
  },
];

export function IcebreakerDialog({
  open,
  onOpenChange,
  contact,
  onCopyMessage,
}: IcebreakerDialogProps) {
  // Form state
  const [channel, setChannel] = useState<IcebreakerChannel>('email');
  const [tone, setTone] = useState<IcebreakerTone>('professional');
  const [triggerEvent, setTriggerEvent] = useState('');

  // UI state
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // Generated data
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [variations, setVariations] = useState<MessageVariation[]>([]);

  // Mutations
  const generateMutation = useGenerateIcebreaker();
  const regenerateMutation = useRegenerateIcebreaker();
  const selectVariationMutation = useSelectVariation();
  const feedbackMutation = useSubmitIcebreakerFeedback();

  const isLoading = generateMutation.isPending || regenerateMutation.isPending;
  const currentVariation = variations[currentVariationIndex];

  const handleGenerate = useCallback(async () => {
    try {
      const result = await generateMutation.mutateAsync({
        contactId: contact.id,
        channel,
        tone,
        triggerEvent: triggerEvent || undefined,
      });
      setGenerationId(result.id);
      setVariations(result.variations);
      setCurrentVariationIndex(0);
      setIsEditing(false);
      setFeedbackGiven(false);
    } catch (error) {
      console.error('Failed to generate icebreaker:', error);
    }
  }, [generateMutation, contact.id, channel, tone, triggerEvent]);

  const handleRegenerate = useCallback(async () => {
    if (!generationId) return;
    try {
      const result = await regenerateMutation.mutateAsync({
        id: generationId,
        input: { tone },
      });
      setGenerationId(result.id);
      setVariations(result.variations);
      setCurrentVariationIndex(0);
      setIsEditing(false);
      setFeedbackGiven(false);
    } catch (error) {
      console.error('Failed to regenerate icebreaker:', error);
    }
  }, [regenerateMutation, generationId, tone]);

  const handleSelectVariation = useCallback(
    async (index: number) => {
      if (!generationId) return;
      setCurrentVariationIndex(index);
      try {
        await selectVariationMutation.mutateAsync({
          id: generationId,
          variationIndex: index,
        });
      } catch (error) {
        console.error('Failed to select variation:', error);
      }
    },
    [selectVariationMutation, generationId],
  );

  const handleCopy = useCallback(
    async (variation: MessageVariation, index: number) => {
      const textToCopy = variation.subject
        ? `Subject: ${variation.subject}\n\n${variation.body}`
        : variation.body;

      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
        onCopyMessage?.(variation.body, variation.subject);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    },
    [onCopyMessage],
  );

  const handleFeedback = useCallback(
    async (feedback: IcebreakerFeedback) => {
      if (!generationId) return;
      try {
        await feedbackMutation.mutateAsync({ id: generationId, feedback });
        setFeedbackGiven(true);
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      }
    },
    [feedbackMutation, generationId],
  );

  const handleStartEdit = useCallback(() => {
    if (currentVariation) {
      setEditedContent(currentVariation.body);
      setIsEditing(true);
    }
  }, [currentVariation]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedContent('');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (currentVariation) {
      // Update the local variation with edited content
      const updatedVariations = [...variations];
      updatedVariations[currentVariationIndex] = {
        ...currentVariation,
        body: editedContent,
      };
      setVariations(updatedVariations);
      setIsEditing(false);
    }
  }, [currentVariation, currentVariationIndex, editedContent, variations]);

  const resetDialog = useCallback(() => {
    setGenerationId(null);
    setVariations([]);
    setCurrentVariationIndex(0);
    setIsEditing(false);
    setEditedContent('');
    setFeedbackGiven(false);
    setTriggerEvent('');
  }, []);

  const handleClose = useCallback(() => {
    resetDialog();
    onOpenChange(false);
  }, [resetDialog, onOpenChange]);

  const contactFullName = `${contact.firstName} ${contact.lastName || ''}`.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Generate Icebreaker for {contactFullName}
          </DialogTitle>
          <DialogDescription>
            Create a personalized message to reconnect with{' '}
            {contact.company ? `${contactFullName} at ${contact.company}` : contactFullName}
          </DialogDescription>
        </DialogHeader>

        {/* Configuration section - shown before generation */}
        {variations.length === 0 && (
          <div className="space-y-6 py-4">
            {/* Channel Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Channel</Label>
              <div className="grid grid-cols-3 gap-3">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setChannel(ch.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                      channel === ch.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <ch.icon className="h-6 w-6" />
                    <span className="font-medium text-sm">{ch.label}</span>
                    <span className="text-xs text-muted-foreground text-center">
                      {ch.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tone</Label>
              <div className="grid grid-cols-3 gap-3">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                      tone === t.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <t.icon className="h-6 w-6" />
                    <span className="font-medium text-sm">{t.label}</span>
                    <span className="text-xs text-muted-foreground text-center">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Event */}
            <div className="space-y-2">
              <Label htmlFor="trigger-event" className="text-sm font-medium">
                Trigger Event (optional)
              </Label>
              <Textarea
                id="trigger-event"
                placeholder="e.g., I saw their recent job change, conference attendance, article publication..."
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Add context to make the message more relevant and personalized
              </p>
            </div>
          </div>
        )}

        {/* Generated Variations */}
        {variations.length > 0 && (
          <div className="space-y-4 py-4">
            {/* Variation Navigator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleSelectVariation(Math.max(0, currentVariationIndex - 1))}
                  disabled={currentVariationIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Variation {currentVariationIndex + 1} of {variations.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    handleSelectVariation(Math.min(variations.length - 1, currentVariationIndex + 1))
                  }
                  disabled={currentVariationIndex === variations.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {CHANNELS.find((c) => c.value === channel)?.label}
                </Badge>
                <Badge variant="secondary">{TONES.find((t) => t.value === tone)?.label}</Badge>
              </div>
            </div>

            {/* Message Content */}
            {currentVariation && (
              <div className="space-y-4">
                {/* Subject Line (for email) */}
                {channel === 'email' && currentVariation.subject && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <div className="rounded-md bg-muted p-3 font-medium">
                      {currentVariation.subject}
                    </div>
                  </div>
                )}

                {/* Message Body */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Message</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                  ) : (
                    <div className="rounded-md bg-muted p-4 whitespace-pre-wrap text-sm leading-relaxed">
                      {currentVariation.body}
                    </div>
                  )}
                </div>

                {/* Talking Points */}
                {currentVariation.talkingPoints.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Key Points</Label>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {currentVariation.talkingPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="default" size="sm" onClick={handleSaveEdit}>
                          Save Changes
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(currentVariation, currentVariationIndex)}
                        >
                          {copiedIndex === currentVariationIndex ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                          Edit
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Feedback */}
                  {!feedbackGiven && !isEditing && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Was this helpful?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback('helpful')}
                        className="h-8 w-8 p-0"
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback('not_helpful')}
                        className="h-8 w-8 p-0"
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {feedbackGiven && !isEditing && (
                    <span className="text-xs text-green-600">Thanks for your feedback!</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {variations.length > 0 ? (
            <>
              <Button variant="outline" onClick={resetDialog}>
                Start Over
              </Button>
              <Button onClick={handleRegenerate} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Message
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}











