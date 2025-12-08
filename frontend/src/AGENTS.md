# Frontend Source AGENTS.md

## Overview

This directory contains all frontend source code organized by feature and responsibility.

## Directory Structure

```
src/
├── app/                           # Next.js App Router
│   ├── (app)/                     # Authenticated app routes
│   │   └── [orgSlug]/             # Organization-scoped routes
│   │       ├── dashboard/
│   │       ├── contacts/
│   │       ├── reminders/
│   │       └── settings/
│   ├── (auth)/                    # Auth routes (login, register)
│   ├── admin/                     # Admin panel
│   ├── layout.tsx                 # Root layout
│   ├── globals.css                # Global styles
│   └── page.tsx                   # Landing page
├── components/                    # React components
│   ├── ui/                        # Base UI components (shadcn)
│   ├── layout/                    # Layout components
│   ├── dashboard/                 # Dashboard widgets
│   ├── ai/                        # AI feature components
│   ├── integrations/              # Integration components
│   ├── notes/                     # Notes components
│   ├── onboarding/                # Onboarding flow
│   ├── organization/              # Organization management
│   ├── search/                    # Search components
│   └── auth/                      # Auth components
├── hooks/                         # Custom React hooks
├── lib/                           # Utilities and services
│   ├── api/                       # API client and services
│   ├── auth/                      # Auth utilities
│   ├── react-query/               # Query client config
│   ├── utils/                     # Helper functions
│   └── validations/               # Zod schemas
├── providers/                     # React context providers
├── store/                         # Zustand state stores
└── types/                         # TypeScript type definitions
```

## App Router Structure

### Route Groups

- `(app)/` - Authenticated routes with sidebar layout
- `(auth)/` - Public auth routes (login, register)
- `admin/` - Admin panel routes

### Dynamic Routes

```
/[orgSlug]/dashboard              # Organization dashboard
/[orgSlug]/contacts               # Contact list
/[orgSlug]/contacts/[id]          # Contact detail
/[orgSlug]/contacts/new           # Create contact
/[orgSlug]/settings               # Settings
/[orgSlug]/settings/integrations  # Integration settings
```

## Example Files by Category

### UI Components

Reference: [components/ui/button.tsx](components/ui/button.tsx)

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### Feature Components

Reference: [components/dashboard/StatsWidget.tsx](components/dashboard/StatsWidget.tsx)

Key patterns:
- Use hooks for data fetching
- Loading states with skeletons
- Error handling

### Custom Hooks

Reference: [hooks/use-contacts.ts](hooks/use-contacts.ts)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

// Query hook
export function useContacts(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.contacts.list(params),
    queryFn: () => contactsService.getContacts(params),
  });
}

// Mutation hook with cache invalidation
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contactsService.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
    },
  });
}
```

### API Services

Reference: [lib/api/services/contacts.service.ts](lib/api/services/contacts.service.ts)

```typescript
import { apiClient } from '../client';
import type { Contact, CreateContactInput } from '@/types';

export const contactsService = {
  getContacts: async (params?: QueryParams): Promise<PaginatedResponse<Contact>> => {
    const response = await apiClient.get<BackendResponse>('/contacts', params);
    return transformResponse(response.data);
  },

  createContact: async (data: CreateContactInput): Promise<Contact> => {
    const response = await apiClient.post<Contact>('/contacts', data);
    return response.data;
  },
};
```

### Query Keys

Reference: [lib/react-query/query-keys.ts](lib/react-query/query-keys.ts)

```typescript
export const queryKeys = {
  contacts: {
    all: ['contacts'] as const,
    lists: () => [...queryKeys.contacts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.contacts.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.contacts.all, id] as const,
    search: (query: string) => [...queryKeys.contacts.all, 'search', query] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
  },
};
```

### Zustand Store

Reference: [store/auth.store.ts](store/auth.store.ts)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);
```

### Type Definitions

Reference: [types/contact.ts](types/contact.ts)

```typescript
export interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  tags: string[];
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  tags?: string[];
}
```

### Validation Schemas

Reference: [lib/validations/contact.schema.ts](lib/validations/contact.schema.ts)

```typescript
import { z } from 'zod';

export const createContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateContactFormData = z.infer<typeof createContactSchema>;
```

## Component Conventions

### shadcn/ui Components

Located in `components/ui/`. Generated via:
```bash
npx shadcn@latest add button
```

### Feature Components

1. Co-locate with feature (e.g., `components/dashboard/`)
2. Export via `index.ts`
3. Use hooks for data, not props drilling

### Form Components

Use `react-hook-form` with Zod:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createContactSchema, type CreateContactFormData } from '@/lib/validations';

const form = useForm<CreateContactFormData>({
  resolver: zodResolver(createContactSchema),
});
```

## Styling

- Tailwind CSS v4 with CSS variables
- `cn()` utility for conditional classes
- Dark mode via `next-themes`

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class'
)} />
```











