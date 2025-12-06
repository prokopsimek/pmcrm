'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ContactPreview } from './ContactPreview';
import { DeduplicationReview } from './DeduplicationReview';
import {
  useGoogleContactsPreview,
  useImportGoogleContacts,
  useGoogleIntegrationStatus,
} from '@/hooks';
import type { TagMapping, PreviewContact } from '@/types';

type WizardStep = 'preview' | 'deduplication' | 'tags' | 'confirm' | 'importing' | 'success';

interface GoogleContactsImportProps {
  onClose: () => void;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Google Contacts Import Wizard
 * Multi-step wizard for importing Google Contacts
 */
export function GoogleContactsImport({
  onClose,
  onSuccess,
  className,
}: GoogleContactsImportProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>('preview');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [tagMappings, setTagMappings] = useState<TagMapping[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);

  // Fetch preview
  const {
    data: previewData,
    isLoading: isLoadingPreview,
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

  const duplicateContacts = contacts.filter((c) => c.duplicateMatch);
  const availableLabels = summary?.availableLabels || [];

  const handleNext = () => {
    if (step === 'preview') {
      if (duplicateContacts.length > 0) {
        setStep('deduplication');
      } else {
        setStep('tags');
      }
    } else if (step === 'deduplication') {
      setStep('tags');
    } else if (step === 'tags') {
      setStep('confirm');
    } else if (step === 'confirm') {
      handleImport();
    }
  };

  const handleBack = () => {
    if (step === 'deduplication') {
      setStep('preview');
    } else if (step === 'tags') {
      if (duplicateContacts.length > 0) {
        setStep('deduplication');
      } else {
        setStep('preview');
      }
    } else if (step === 'confirm') {
      setStep('tags');
    }
  };

  const handleDuplicateResolve = (contactId: string, action: 'skip' | 'import' | 'merge') => {
    if (action === 'skip') {
      setSelectedContactIds(selectedContactIds.filter((id) => id !== contactId));
    } else if (action === 'import') {
      if (!selectedContactIds.includes(contactId)) {
        setSelectedContactIds([...selectedContactIds, contactId]);
      }
    } else if (action === 'merge') {
      setUpdateExisting(true);
      if (!selectedContactIds.includes(contactId)) {
        setSelectedContactIds([...selectedContactIds, contactId]);
      }
    }
  };

  const handleAddTagMapping = () => {
    if (availableLabels.length > 0) {
      setTagMappings([...tagMappings, { googleLabel: availableLabels[0], customTag: '' }]);
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

  const handleImport = async () => {
    setStep('importing');

    try {
      // Convert tagMappings array to tagMapping object as expected by backend
      const tagMapping: Record<string, string> = {};
      tagMappings.filter((m) => m.customTag.trim() !== '').forEach((m) => {
        tagMapping[m.googleLabel] = m.customTag;
      });

      const result = await importMutation.mutateAsync({
        selectedContactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
        skipDuplicates,
        updateExisting,
        tagMapping: Object.keys(tagMapping).length > 0 ? tagMapping : undefined,
      });

      setStep('success');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Import failed:', error);
      // Stay on importing step to show error
    }
  };

  const canProceed = () => {
    if (step === 'preview') {
      return selectedContactIds.length > 0 || contacts.length > 0;
    }
    return true;
  };

  return (
    <div className={cn('bg-white rounded-lg shadow-xl', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Import Google Contacts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mt-6">
          <StepIndicator
            steps={[
              { id: 'preview', label: 'Preview' },
              { id: 'deduplication', label: 'Duplicates', hidden: duplicateContacts.length === 0 },
              { id: 'tags', label: 'Tags' },
              { id: 'confirm', label: 'Confirm' },
            ]}
            currentStep={step}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading contacts...</span>
          </div>
        ) : step === 'preview' ? (
          <PreviewStep
            contacts={contacts}
            summary={summary}
            selectedIds={selectedContactIds}
            onSelectionChange={setSelectedContactIds}
          />
        ) : step === 'deduplication' ? (
          <DeduplicationStep
            contacts={duplicateContacts}
            onResolve={handleDuplicateResolve}
          />
        ) : step === 'tags' ? (
          <TagMappingStep
            availableLabels={availableLabels}
            tagMappings={tagMappings}
            onAdd={handleAddTagMapping}
            onRemove={handleRemoveTagMapping}
            onUpdate={handleUpdateTagMapping}
          />
        ) : step === 'confirm' ? (
          <ConfirmStep
            selectedCount={selectedContactIds.length || contacts.length}
            skipDuplicates={skipDuplicates}
            updateExisting={updateExisting}
            tagMappings={tagMappings}
            onToggleSkipDuplicates={() => setSkipDuplicates(!skipDuplicates)}
            onToggleUpdateExisting={() => setUpdateExisting(!updateExisting)}
          />
        ) : step === 'importing' ? (
          <ImportingStep isError={importMutation.isError} error={importMutation.error} />
        ) : (
          <SuccessStep
            imported={importMutation.data?.imported || 0}
            skipped={importMutation.data?.skipped || 0}
            updated={importMutation.data?.updated || 0}
            errors={importMutation.data?.errors || 0}
          />
        )}
      </div>

      {/* Footer */}
      {step !== 'importing' && step !== 'success' && (
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 'preview'}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {step === 'confirm' ? 'Import Contacts' : 'Next'}
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-components for each step

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: Array<{ id: string; label: string; hidden?: boolean }>;
  currentStep: string;
}) {
  const visibleSteps = steps.filter((s) => !s.hidden);
  const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {visibleSteps.map((step, index) => (
          <li
            key={step.id}
            className={cn('relative', index !== visibleSteps.length - 1 && 'flex-1')}
          >
            <div className="flex items-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  index <= currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  'ml-2 text-sm font-medium',
                  index <= currentIndex ? 'text-blue-600' : 'text-gray-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {index !== visibleSteps.length - 1 && (
              <div
                className={cn(
                  'absolute top-4 left-10 -ml-px h-0.5 w-full',
                  index < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PreviewStep({
  contacts,
  summary,
  selectedIds,
  onSelectionChange,
}: {
  contacts: PreviewContact[];
  summary: any;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Import Summary</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-blue-700">Total Contacts:</dt>
              <dd className="font-semibold text-blue-900">{summary.total}</dd>
            </div>
            <div>
              <dt className="text-blue-700">New Contacts:</dt>
              <dd className="font-semibold text-blue-900">{summary.newContacts}</dd>
            </div>
            <div>
              <dt className="text-blue-700">Exact Duplicates:</dt>
              <dd className="font-semibold text-blue-900">{summary.exactDuplicates}</dd>
            </div>
            <div>
              <dt className="text-blue-700">Potential Duplicates:</dt>
              <dd className="font-semibold text-blue-900">{summary.potentialDuplicates}</dd>
            </div>
          </dl>
        </div>
      )}

      <ContactPreview
        contacts={contacts}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />

      <p className="text-sm text-gray-500">
        Select contacts to import or proceed to import all contacts.
      </p>
    </div>
  );
}

function DeduplicationStep({
  contacts,
  onResolve,
}: {
  contacts: PreviewContact[];
  onResolve: (contactId: string, action: 'skip' | 'import' | 'merge') => void;
}) {
  return <DeduplicationReview contacts={contacts} onResolve={onResolve} />;
}

function TagMappingStep({
  availableLabels,
  tagMappings,
  onAdd,
  onRemove,
  onUpdate,
}: {
  availableLabels: string[];
  tagMappings: TagMapping[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: 'googleLabel' | 'customTag', value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Map Google Labels to Tags</h3>
        <p className="text-sm text-gray-500 mb-4">
          Map your Google Contact labels to custom tags in your CRM.
        </p>
      </div>

      {tagMappings.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-600 mb-4">No tag mappings configured</p>
          <button
            onClick={onAdd}
            disabled={availableLabels.length === 0}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            + Add Tag Mapping
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tagMappings.map((mapping, index) => (
            <div key={index} className="flex items-center gap-3">
              <select
                value={mapping.googleLabel}
                onChange={(e) => onUpdate(index, 'googleLabel', e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                {availableLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="text-gray-400">→</span>
              <input
                type="text"
                value={mapping.customTag}
                onChange={(e) => onUpdate(index, 'customTag', e.target.value)}
                placeholder="Custom tag name"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => onRemove(index)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                aria-label="Remove mapping"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={onAdd}
            disabled={availableLabels.length === 0}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            + Add Another Mapping
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmStep({
  selectedCount,
  skipDuplicates,
  updateExisting,
  tagMappings,
  onToggleSkipDuplicates,
  onToggleUpdateExisting,
}: {
  selectedCount: number;
  skipDuplicates: boolean;
  updateExisting: boolean;
  tagMappings: TagMapping[];
  onToggleSkipDuplicates: () => void;
  onToggleUpdateExisting: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Import Settings</h3>
        <p className="text-sm text-gray-600">
          Review your import settings before proceeding.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm font-medium text-gray-700">Contacts to import:</span>
          <span className="text-sm font-semibold text-gray-900">{selectedCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm font-medium text-gray-700">Tag mappings:</span>
          <span className="text-sm font-semibold text-gray-900">
            {tagMappings.filter((m) => m.customTag.trim() !== '').length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={onToggleSkipDuplicates}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">Skip exact duplicates</div>
            <div className="text-sm text-gray-500">
              Don't import contacts that exactly match existing ones
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={updateExisting}
            onChange={onToggleUpdateExisting}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">Update existing contacts</div>
            <div className="text-sm text-gray-500">
              Merge data from Google with existing contacts
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

function ImportingStep({ isError, error }: { isError: boolean; error: any }) {
  if (isError) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">Import Failed</h3>
        <p className="mt-2 text-sm text-gray-500">
          {error?.message || 'An error occurred while importing contacts.'}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <LoadingSpinner size="lg" className="mx-auto" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">Importing Contacts...</h3>
      <p className="mt-2 text-sm text-gray-500">
        This may take a few moments. Please don't close this window.
      </p>
    </div>
  );
}

function SuccessStep({
  imported,
  skipped,
  updated,
  errors,
}: {
  imported: number;
  skipped: number;
  updated: number;
  errors: number;
}) {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-16 w-16 text-green-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">Import Complete!</h3>
      <p className="mt-2 text-sm text-gray-500">
        Your Google contacts have been imported successfully.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
        {imported > 0 && (
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{imported}</div>
            <div className="text-sm text-green-800">Imported</div>
          </div>
        )}
        {updated > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{updated}</div>
            <div className="text-sm text-blue-800">Updated</div>
          </div>
        )}
        {skipped > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{skipped}</div>
            <div className="text-sm text-yellow-800">Skipped</div>
          </div>
        )}
        {errors > 0 && (
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{errors}</div>
            <div className="text-sm text-red-800">Errors</div>
          </div>
        )}
      </div>
    </div>
  );
}
