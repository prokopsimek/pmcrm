'use client';

import { cn } from '@/lib/utils';
import type { PreviewContact, DuplicateMatch } from '@/types';

interface DeduplicationReviewProps {
  contacts: PreviewContact[];
  onResolve: (contactId: string, action: 'skip' | 'import' | 'merge') => void;
  className?: string;
}

/**
 * Deduplication Review Component
 * Shows duplicate matches and allows user to resolve them
 */
export function DeduplicationReview({
  contacts,
  onResolve,
  className,
}: DeduplicationReviewProps) {
  const duplicates = contacts.filter((c) => c.duplicateMatch);

  if (duplicates.length === 0) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Duplicates Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            All contacts are unique and ready to import.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-yellow-600 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              {duplicates.length} Potential Duplicate{duplicates.length > 1 ? 's' : ''} Found
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              Review the matches below and choose how to handle each duplicate.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {duplicates.map((contact) => (
          <DuplicateMatchCard
            key={contact.id}
            contact={contact}
            match={contact.duplicateMatch!}
            onResolve={(action) => onResolve(contact.id, action)}
          />
        ))}
      </div>
    </div>
  );
}

interface DuplicateMatchCardProps {
  contact: PreviewContact;
  match: DuplicateMatch;
  onResolve: (action: 'skip' | 'import' | 'merge') => void;
}

function DuplicateMatchCard({ contact, match, onResolve }: DuplicateMatchCardProps) {
  const matchTypeConfig = {
    exact: {
      title: 'Exact Match',
      description: 'This contact already exists in your database',
      className: 'border-red-200 bg-red-50',
      badgeClassName: 'bg-red-100 text-red-800',
    },
    fuzzy: {
      title: 'Likely Duplicate',
      description: 'This contact is very similar to an existing one',
      className: 'border-yellow-200 bg-yellow-50',
      badgeClassName: 'bg-yellow-100 text-yellow-800',
    },
    potential: {
      title: 'Potential Match',
      description: 'This contact might be related to an existing one',
      className: 'border-orange-200 bg-orange-50',
      badgeClassName: 'bg-orange-100 text-orange-800',
    },
  };

  const config = matchTypeConfig[match.type];

  return (
    <div className={cn('border rounded-lg p-6', config.className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">{config.title}</h4>
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.badgeClassName)}>
              {(match.score * 100).toFixed(0)}% match
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{config.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* New Contact */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h5 className="text-xs font-medium text-gray-500 uppercase mb-3">New Contact</h5>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-900">
                {contact.firstName} {contact.lastName}
              </span>
            </div>
            {contact.email && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Phone:</span> {contact.phone}
              </div>
            )}
            {contact.company && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Company:</span> {contact.company}
              </div>
            )}
          </div>
        </div>

        {/* Existing Contact */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h5 className="text-xs font-medium text-gray-500 uppercase mb-3">Existing Contact</h5>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-900">
                {match.existingContact.firstName} {match.existingContact.lastName}
              </span>
            </div>
            {match.existingContact.email && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {match.existingContact.email}
              </div>
            )}
            {match.existingContact.phone && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Phone:</span> {match.existingContact.phone}
              </div>
            )}
          </div>
        </div>
      </div>

      {match.matchedFields.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">MATCHED FIELDS</p>
          <div className="flex flex-wrap gap-2">
            {match.matchedFields.map((field, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => onResolve('skip')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={() => onResolve('import')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Import Anyway
        </button>
        {match.type !== 'exact' && (
          <button
            onClick={() => onResolve('merge')}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            Merge
          </button>
        )}
      </div>
    </div>
  );
}
