# Google Contacts Integration Components

## Quick Start

### Using the Integration in Your App

```tsx
import { IntegrationCard, GoogleContactsImport } from '@/components/integrations';
import { useGoogleIntegrationStatus, useInitiateGoogleAuth } from '@/hooks';

function MyPage() {
  const { data: status } = useGoogleIntegrationStatus();
  const initiateAuth = useInitiateGoogleAuth();
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <IntegrationCard
        type="GOOGLE_CONTACTS"
        name="Google Contacts"
        description="Import contacts from Google"
        icon={<GoogleIcon />}
        status={status?.integration?.status || 'DISCONNECTED'}
        isConnected={status?.isConnected || false}
        onConnect={() => initiateAuth.mutate()}
        onDisconnect={() => {/* handle disconnect */}}
        onManage={() => setShowImport(true)}
      />

      {showImport && (
        <GoogleContactsImport
          onClose={() => setShowImport(false)}
          onSuccess={() => {/* handle success */}}
        />
      )}
    </>
  );
}
```

## Components

### IntegrationCard
Reusable card for displaying integration status.

**Props:**
- `type`: Integration type enum
- `name`: Display name
- `description`: Short description
- `icon`: React node for icon
- `status`: Current status
- `isConnected`: Boolean connection state
- `onConnect`, `onDisconnect`, `onManage`: Action handlers

### ContactPreview
Table for selecting contacts to import.

**Props:**
- `contacts`: Array of preview contacts
- `selectedIds`: Array of selected contact IDs
- `onSelectionChange`: Handler for selection changes

### DeduplicationReview
Review and resolve duplicate contacts.

**Props:**
- `contacts`: Contacts with duplicate matches
- `onResolve`: Handler for resolution (skip/import/merge)

### GoogleContactsImport
Complete import wizard modal.

**Props:**
- `onClose`: Close handler
- `onSuccess`: Success callback

## Hooks

```typescript
// Query hooks (data fetching)
const { data, isLoading } = useGoogleIntegrationStatus();
const { data, refetch } = useGoogleContactsPreview();
const { data } = useIntegrations();

// Mutation hooks (actions)
const initiateAuth = useInitiateGoogleAuth();
const importContacts = useImportGoogleContacts();
const syncContacts = useSyncGoogleContacts();
const disconnect = useDisconnectGoogleIntegration();

// Usage
initiateAuth.mutate(); // Redirects to Google OAuth
await importContacts.mutateAsync({ selectedContactIds: [...] });
```

## Pages

### `/settings/integrations`
Main integrations management page with all available integrations.

### `/integrations/google/callback`
OAuth callback handler (automatic redirect from Google).

## Styling

All components use Tailwind CSS. Key design tokens:

```css
/* Status colors */
.status-active { @apply bg-green-100 text-green-800; }
.status-error { @apply bg-red-100 text-red-800; }
.status-pending { @apply bg-yellow-100 text-yellow-800; }
.status-disconnected { @apply bg-gray-100 text-gray-800; }

/* Duplicate match colors */
.match-exact { @apply border-red-200 bg-red-50; }
.match-fuzzy { @apply border-yellow-200 bg-yellow-50; }
.match-potential { @apply border-orange-200 bg-orange-50; }
```

## Accessibility

All components include:
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management
- Semantic HTML

## Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { IntegrationCard } from './IntegrationCard';

test('calls onConnect when connect button clicked', () => {
  const handleConnect = jest.fn();

  render(
    <IntegrationCard
      type="GOOGLE_CONTACTS"
      name="Google"
      description="Import contacts"
      icon={<div>Icon</div>}
      status="DISCONNECTED"
      isConnected={false}
      onConnect={handleConnect}
      onDisconnect={() => {}}
    />
  );

  fireEvent.click(screen.getByText('Connect'));
  expect(handleConnect).toHaveBeenCalledTimes(1);
});
```

## Common Patterns

### Show import wizard after connection
```tsx
const [showWizard, setShowWizard] = useState(false);

useEffect(() => {
  if (googleStatus?.isConnected && !hasSeenWizard) {
    setShowWizard(true);
  }
}, [googleStatus?.isConnected]);
```

### Auto-sync on interval
```tsx
const syncMutation = useSyncGoogleContacts();

useEffect(() => {
  const interval = setInterval(() => {
    if (status?.isConnected) {
      syncMutation.mutate();
    }
  }, 60 * 60 * 1000); // Every hour

  return () => clearInterval(interval);
}, [status?.isConnected]);
```

### Handle OAuth errors
```tsx
const searchParams = useSearchParams();

useEffect(() => {
  const error = searchParams.get('error');
  if (error === 'access_denied') {
    toast.error('Google access was denied');
  }
}, [searchParams]);
```

## Troubleshooting

**Contacts not loading**
- Check backend API is running
- Verify OAuth tokens are valid
- Check browser console for errors

**OAuth redirect fails**
- Verify redirect URI in Google Console
- Check HTTPS is enabled in production
- Verify state parameter is being validated

**Duplicates not detecting**
- Backend deduplication service must be running
- Check contact has email or phone for matching
- Review match threshold settings in backend

## API Reference

See `/frontend/GOOGLE_CONTACTS_UI_COMPLETE.md` for complete API documentation.
