'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ContactPreview } from './ContactPreview';
import { DeduplicationReview } from './DeduplicationReview';
import {
  useMicrosoftContactsPreview,
  useImportMicrosoftContacts,
  useMicrosoftIntegrationStatus,
} from '@/hooks';
import type { CategoryMapping, PreviewContact } from '@/types';

type WizardStep = 'preview' | 'deduplication' | 'categories' | 'confirm' | 'importing' | 'success';

interface MicrosoftContactsImportProps {
  onClose: () => void;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Microsoft 365 Contacts Import Wizard
 * Multi-step wizard for importing Microsoft 365/Outlook Contacts
 */
export function MicrosoftContactsImport({
  onClose,
  onSuccess,
  className,
}: MicrosoftContactsImportProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>('preview');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preserveOriginalCategories, setPreserveOriginalCategories] = useState(true);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

  // Fetch preview
  const {
    data: previewData,
    isLoading: isLoadingPreview,
    refetch: refetchPreview,
  } = useMicrosoftContactsPreview();

  // Import mutation
  const importMutation = useImportMicrosoftContacts();

  // Fetch preview on mount
  useEffect(() => {
    refetchPreview();
  }, [refetchPreview]);

  const contacts = previewData?.newContacts || [];
  const duplicates = previewData?.duplicates || [];
  const summary = previewData?.summary;
  const availableCategories = previewData?.tagsPreview || [];
  const sharedFolders = previewData?.sharedFolders || [];

  const handleNext = () => {
    if (step === 'preview') {
      if (duplicates.length > 0) {
        setStep('deduplication');
      } else {
        setStep('categories');
      }
    } else if (step === 'deduplication') {
      setStep('categories');
    } else if (step === 'categories') {
      setStep('confirm');
    } else if (step === 'confirm') {
      handleImport();
    }
  };

  const handleBack = () => {
    if (step === 'deduplication') {
      setStep('preview');
    } else if (step === 'categories') {
      if (duplicates.length > 0) {
        setStep('deduplication');
      } else {
        setStep('preview');
      }
    } else if (step === 'confirm') {
      setStep('categories');
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

  const handleAddCategoryMapping = () => {
    if (availableCategories.length > 0) {
      setCategoryMappings([
        ...categoryMappings,
        { outlookCategory: availableCategories[0], customTag: '' },
      ]);
    }
  };

  const handleRemoveCategoryMapping = (index: number) => {
    setCategoryMappings(categoryMappings.filter((_, i) => i !== index));
  };

  const handleUpdateCategoryMapping = (
    index: number,
    field: 'outlookCategory' | 'customTag',
    value: string,
  ) => {
    const updated = [...categoryMappings];
    updated[index][field] = value;
    setCategoryMappings(updated);
  };

  const handleToggleFolder = (folderId: string) => {
    if (selectedFolders.includes(folderId)) {
      setSelectedFolders(selectedFolders.filter((id) => id !== folderId));
    } else {
      setSelectedFolders([...selectedFolders, folderId]);
    }
  };

  const handleImport = async () => {
    setStep('importing');

    try {
      // Build category mapping object
      const categoryMapping: Record<string, string> = {};
      categoryMappings
        .filter((m) => m.customTag.trim() !== '')
        .forEach((m) => {
          categoryMapping[m.outlookCategory] = m.customTag;
        });

      const result = await importMutation.mutateAsync({
        selectedContactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
        skipDuplicates,
        updateExisting,
        categoryMapping: Object.keys(categoryMapping).length > 0 ? categoryMapping : undefined,
        preserveOriginalCategories,
        includeFolders: selectedFolders.length > 0 ? selectedFolders : undefined,
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

  if (isLoadingPreview) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        <StepIndicator
          steps={[
            { id: 'preview', label: 'Preview' },
            { id: 'deduplication', label: 'Duplicates', show: duplicates.length > 0 },
            { id: 'categories', label: 'Categories' },
            { id: 'confirm', label: 'Confirm' },
          ]}
          currentStep={step}
        />
      </div>

      {/* Step content */}
      {step === 'preview' && (
        <PreviewStep
          contacts={contacts}
          summary={summary}
          sharedFolders={sharedFolders}
          selectedFolders={selectedFolders}
          onToggleFolder={handleToggleFolder}
          onNext={handleNext}
          onCancel={onClose}
        />
      )}

      {step === 'deduplication' && (
        <DeduplicationStep
          duplicates={duplicates}
          onResolve={handleDuplicateResolve}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {step === 'categories' && (
        <CategoriesStep
          availableCategories={availableCategories}
          categoryMappings={categoryMappings}
          preserveOriginalCategories={preserveOriginalCategories}
          onAddMapping={handleAddCategoryMapping}
          onRemoveMapping={handleRemoveCategoryMapping}
          onUpdateMapping={handleUpdateCategoryMapping}
          onTogglePreserve={setPreserveOriginalCategories}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          summary={summary}
          selectedCount={selectedContactIds.length || contacts.length}
          categoryMappings={categoryMappings}
          skipDuplicates={skipDuplicates}
          updateExisting={updateExisting}
          onConfirm={handleImport}
          onBack={handleBack}
        />
      )}

      {step === 'importing' && (
        <ImportingStep
          progress={importMutation.isPending ? 50 : 100}
          isError={importMutation.isError}
          error={importMutation.error}
        />
      )}

      {step === 'success' && (
        <SuccessStep
          imported={importMutation.data?.imported || 0}
          updated={importMutation.data?.updated || 0}
          skipped={importMutation.data?.skipped || 0}
          failed={importMutation.data?.failed || 0}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// Sub-components for each step (simplified placeholders)
function StepIndicator({ steps, currentStep }: any) {
  return (
    <div className="flex items-center space-x-2">
      {steps
        .filter((s: any) => s.show !== false)
        .map((step: any, index: number) => (
          <div
            key={step.id}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              currentStep === step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600',
            )}
          >
            {step.label}
          </div>
        ))}
    </div>
  );
}

function PreviewStep({ contacts, summary, sharedFolders, onNext, onCancel }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">
        Microsoft 365 Contacts Preview
      </h2>
      <p className="text-gray-600">
        Found {summary?.total || 0} contacts. {summary?.new || 0} are new,{' '}
        {summary?.exactDuplicates || 0} exact duplicates.
      </p>
      {sharedFolders && sharedFolders.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Shared Address Books</h3>
          <p className="text-sm text-gray-600">
            {sharedFolders.length} shared folders available
          </p>
        </div>
      )}
      <div className="flex space-x-4 mt-6">
        <button onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg">
          Next
        </button>
        <button onClick={onCancel} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeduplicationStep({ duplicates, onNext, onBack }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Review Duplicates</h2>
      <p className="text-gray-600">Found {duplicates.length} potential duplicates</p>
      <div className="flex space-x-4 mt-6">
        <button onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg">
          Next
        </button>
        <button onClick={onBack} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg">
          Back
        </button>
      </div>
    </div>
  );
}

function CategoriesStep({
  availableCategories,
  categoryMappings,
  onAddMapping,
  onNext,
  onBack,
}: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Map Outlook Categories</h2>
      <p className="text-gray-600">
        Map Outlook categories to custom tags ({availableCategories.length} available)
      </p>
      <button onClick={onAddMapping} className="text-blue-600 hover:underline">
        + Add Category Mapping
      </button>
      <div className="flex space-x-4 mt-6">
        <button onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg">
          Next
        </button>
        <button onClick={onBack} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg">
          Back
        </button>
      </div>
    </div>
  );
}

function ConfirmStep({ summary, selectedCount, onConfirm, onBack }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Confirm Import</h2>
      <p className="text-gray-600">Ready to import {selectedCount} contacts</p>
      <div className="flex space-x-4 mt-6">
        <button onClick={onConfirm} className="px-6 py-2 bg-green-600 text-white rounded-lg">
          Import Contacts
        </button>
        <button onClick={onBack} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg">
          Back
        </button>
      </div>
    </div>
  );
}

function ImportingStep({ progress, isError, error }: any) {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Importing Contacts...</h2>
      {!isError && <LoadingSpinner />}
      {isError && (
        <div className="text-red-600">
          <p>Import failed: {error?.message}</p>
        </div>
      )}
    </div>
  );
}

function SuccessStep({ imported, updated, skipped, failed, onClose }: any) {
  return (
    <div className="space-y-4 text-center">
      <div className="text-green-600 text-6xl">✓</div>
      <h2 className="text-2xl font-bold text-gray-900">Import Complete!</h2>
      <div className="text-gray-600 space-y-1">
        <p>{imported} contacts imported</p>
        <p>{updated} contacts updated</p>
        <p>{skipped} contacts skipped</p>
        {failed > 0 && <p className="text-red-600">{failed} contacts failed</p>}
      </div>
      <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg mt-6">
        Done
      </button>
    </div>
  );
}
