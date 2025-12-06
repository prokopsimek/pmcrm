'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    useGoogleContactsPreview,
    useImportGoogleContacts,
} from '@/hooks';
import { cn } from '@/lib/utils';
import type { PreviewContact, TagMapping } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle,
    Loader2,
    Sparkles,
    Tag,
    Users,
    X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContactPreview } from './ContactPreview';
import { ImportSummaryCards } from './ImportSummaryCards';

// Step configuration
const STEPS = [
  { id: 'preview', label: 'Select Contacts', icon: Users },
  { id: 'tags', label: 'Map Labels', icon: Tag },
  { id: 'confirm', label: 'Import', icon: CheckCircle },
] as const;

type StepId = typeof STEPS[number]['id'];

interface ContactImportWizardProps {
  provider: 'google' | 'microsoft';
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Contact Import Wizard - Full page multi-step wizard
 */
export function ContactImportWizard({
  provider,
  onSuccess,
  onCancel,
}: ContactImportWizardProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<StepId>('preview');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [tagMappings, setTagMappings] = useState<TagMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: number;
  } | null>(null);

  // Fetch preview
  const {
    data: previewData,
    isLoading: isLoadingPreview,
    error: previewError,
    refetch: refetchPreview,
  } = useGoogleContactsPreview();

  // Import mutation
  const importMutation = useImportGoogleContacts();

  // Fetch preview on mount
  useEffect(() => {
    refetchPreview();
  }, [refetchPreview]);

  const contacts = previewData?.contacts || [];
  const summary = previewData?.summary;
  const availableLabels = summary?.availableLabels || [];

  // Deduplicate contacts by id (Google API may return duplicates)
  const uniqueContacts = useMemo(() => {
    const seen = new Set<string>();
    return contacts.filter((contact) => {
      if (seen.has(contact.id)) {
        return false;
      }
      seen.add(contact.id);
      return true;
    });
  }, [contacts]);

  // Compute summary stats
  const summaryStats = useMemo(() => {
    const total = uniqueContacts.length;
    const exactDuplicates = uniqueContacts.filter(c => c.duplicateMatch?.type === 'exact').length;
    const potentialDuplicates = uniqueContacts.filter(c =>
      c.duplicateMatch?.type === 'fuzzy' || c.duplicateMatch?.type === 'potential'
    ).length;
    const readyToImport = total - exactDuplicates;

    return {
      total,
      exactDuplicates,
      potentialDuplicates,
      readyToImport,
    };
  }, [uniqueContacts]);

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Navigation handlers
  const handleNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [currentStepIndex]);

  const handleBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }, [currentStepIndex]);

  // Import handler
  const handleImport = async () => {
    setIsImporting(true);

    try {
      // Convert tagMappings array to tagMapping object
      const tagMapping: Record<string, string> = {};
      tagMappings.filter(m => m.customTag.trim() !== '').forEach(m => {
        tagMapping[m.googleLabel] = m.customTag;
      });

      const result = await importMutation.mutateAsync({
        selectedContactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
        skipDuplicates: true,
        updateExisting: false,
        tagMapping: Object.keys(tagMapping).length > 0 ? tagMapping : undefined,
      });

      setImportResult({
        imported: result.imported,
        errors: result.errors,
      });

      // Invalidate contacts query
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        imported: 0,
        errors: 1,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Tag mapping handlers
  const handleAddTagMapping = () => {
    if (availableLabels.length > 0) {
      const unusedLabel = availableLabels.find(
        label => !tagMappings.some(m => m.googleLabel === label)
      ) || availableLabels[0];
      setTagMappings([...tagMappings, { googleLabel: unusedLabel, customTag: '' }]);
    }
  };

  const handleRemoveTagMapping = (index: number) => {
    setTagMappings(tagMappings.filter((_, i) => i !== index));
  };

  const handleUpdateTagMapping = (index: number, field: 'googleLabel' | 'customTag', value: string) => {
    const updated = [...tagMappings];
    updated[index][field] = value;
    setTagMappings(updated);
  };

  // Can proceed to next step?
  const canProceed = currentStep === 'preview'
    ? uniqueContacts.length > 0
    : true;

  // Loading state
  if (isLoadingPreview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-full p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Loading your contacts</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Fetching contacts from Google...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (previewError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="bg-destructive/10 rounded-full p-4">
          <X className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Failed to load contacts</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {previewError instanceof Error ? previewError.message : 'An error occurred'}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchPreview()}>
          Try Again
        </Button>
      </div>
    );
  }

  // Import result state
  if (importResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-full p-6">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-2xl">Import Complete!</h3>
          <p className="text-muted-foreground mt-2">
            Successfully imported {importResult.imported} contacts
          </p>
          {importResult.errors > 0 && (
            <p className="text-destructive text-sm mt-1">
              {importResult.errors} contacts failed to import
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Back to Integrations
          </Button>
          <Button onClick={onSuccess}>
            <Sparkles className="h-4 w-4 mr-2" />
            View Contacts
          </Button>
        </div>
      </div>
    );
  }

  // Importing state
  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-full p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Importing contacts...</h3>
          <p className="text-muted-foreground text-sm mt-1">
            This may take a moment. Please don't close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Step Indicator */}
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-red-500 to-yellow-500 rounded-xl p-2.5 shadow-lg shadow-red-500/20">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Import Google Contacts</h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      'w-12 h-0.5 mx-2 transition-colors duration-300',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300',
                      isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110',
                      isCompleted && 'bg-primary text-primary-foreground',
                      !isActive && !isCompleted && 'bg-muted text-muted-foreground'
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
                      'text-xs font-medium transition-colors',
                      isActive && 'text-primary',
                      isCompleted && 'text-primary',
                      !isActive && !isCompleted && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        {currentStep === 'preview' && (
          <PreviewStepContent
            contacts={uniqueContacts}
            summary={summaryStats}
            selectedIds={selectedContactIds}
            onSelectionChange={setSelectedContactIds}
          />
        )}

        {currentStep === 'tags' && (
          <TagMappingStepContent
            availableLabels={availableLabels}
            tagMappings={tagMappings}
            onAdd={handleAddTagMapping}
            onRemove={handleRemoveTagMapping}
            onUpdate={handleUpdateTagMapping}
          />
        )}

        {currentStep === 'confirm' && (
          <ConfirmStepContent
            selectedCount={selectedContactIds.length || summaryStats.readyToImport}
            totalCount={summaryStats.total}
            tagMappingsCount={tagMappings.filter(m => m.customTag.trim() !== '').length}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="ghost"
          onClick={currentStep === 'preview' ? onCancel : handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 'preview' ? 'Cancel' : 'Back'}
        </Button>

        <div className="flex items-center gap-3">
          {currentStep === 'preview' && (
            <span className="text-sm text-muted-foreground">
              {selectedContactIds.length > 0
                ? `${selectedContactIds.length} selected`
                : `${summaryStats.readyToImport} contacts ready`}
            </span>
          )}

          {currentStep === 'confirm' ? (
            <Button onClick={handleImport} disabled={!canProceed} size="lg">
              <CheckCircle className="h-4 w-4 mr-2" />
              Import Contacts
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed}>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Preview Step Content
interface PreviewStepContentProps {
  contacts: PreviewContact[];
  summary: {
    total: number;
    exactDuplicates: number;
    potentialDuplicates: number;
    readyToImport: number;
  };
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function PreviewStepContent({
  contacts,
  summary,
  selectedIds,
  onSelectionChange,
}: PreviewStepContentProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <ImportSummaryCards
        total={summary.total}
        readyToImport={summary.readyToImport}
        exactDuplicates={summary.exactDuplicates}
        potentialDuplicates={summary.potentialDuplicates}
      />

      {/* Contact Preview Table */}
      <ContactPreview
        contacts={contacts}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />
    </div>
  );
}

// Tag Mapping Step Content
interface TagMappingStepContentProps {
  availableLabels: string[];
  tagMappings: TagMapping[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: 'googleLabel' | 'customTag', value: string) => void;
}

function TagMappingStepContent({
  availableLabels,
  tagMappings,
  onAdd,
  onRemove,
  onUpdate,
}: TagMappingStepContentProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Map Google Labels to Tags</h2>
            <p className="text-muted-foreground mt-2">
              Convert your Google Contact labels to CRM tags. This step is optional.
            </p>
          </div>

          {availableLabels.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">
                No Google labels found in your contacts.
              </p>
            </div>
          ) : tagMappings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No tag mappings configured yet
              </p>
              <Button variant="outline" onClick={onAdd}>
                Add Tag Mapping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tagMappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Google Label
                    </label>
                    <select
                      value={mapping.googleLabel}
                      onChange={(e) => onUpdate(index, 'googleLabel', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border bg-background"
                    >
                      {availableLabels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />

                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      CRM Tag
                    </label>
                    <input
                      type="text"
                      value={mapping.customTag}
                      onChange={(e) => onUpdate(index, 'customTag', e.target.value)}
                      placeholder="Enter tag name"
                      className="w-full h-10 px-3 rounded-md border bg-background"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="mt-5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={onAdd}
                className="w-full"
                disabled={tagMappings.length >= availableLabels.length}
              >
                Add Another Mapping
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Confirm Step Content
interface ConfirmStepContentProps {
  selectedCount: number;
  totalCount: number;
  tagMappingsCount: number;
}

function ConfirmStepContent({
  selectedCount,
  totalCount,
  tagMappingsCount,
}: ConfirmStepContentProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>

          <h2 className="text-xl font-semibold mb-2">Ready to Import</h2>
          <p className="text-muted-foreground mb-8">
            Review your import settings and click Import to proceed.
          </p>

          <div className="bg-muted/50 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Contacts to import</span>
              <span className="font-semibold text-lg">{selectedCount}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Tag mappings</span>
              <span className="font-semibold">{tagMappingsCount}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Duplicate handling</span>
              <Badge variant="secondary">Skip exact duplicates</Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Existing contacts with the same email will be updated with new information.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


