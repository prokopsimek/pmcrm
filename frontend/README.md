# Personal Network CRM - Frontend

Modern Next.js 14+ frontend application with App Router for managing professional networks and relationships.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**:
  - Zustand (client state)
  - TanStack Query (server state)
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, register)
│   ├── dashboard/         # Dashboard page
│   └── layout.tsx         # Root layout
├── components/            # Shared components
│   ├── auth/             # Authentication components
│   ├── layout/           # Layout components
│   ├── providers/        # Context providers
│   └── ui/               # UI components
├── features/             # Feature-specific components
│   ├── auth/            # Auth features
│   ├── contacts/        # Contacts features
│   ├── interactions/    # Interactions features
│   └── companies/       # Companies features
├── hooks/               # Custom React hooks
│   ├── use-auth.ts
│   └── use-contacts.ts
├── lib/                 # Utilities and configs
│   ├── api/            # API client and services
│   ├── react-query/    # React Query setup
│   ├── utils/          # Helper functions
│   └── validations/    # Zod schemas
├── store/              # Zustand stores
│   └── auth.store.ts
└── types/              # TypeScript types
    ├── api.ts
    ├── auth.ts
    └── contact.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Update environment variables as needed
```

### Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_VERSION=v1

# Authentication
NEXT_PUBLIC_AUTH_TOKEN_KEY=pmcrm_auth_token
NEXT_PUBLIC_REFRESH_TOKEN_KEY=pmcrm_refresh_token

# Application
NEXT_PUBLIC_APP_NAME=Personal Network CRM
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Features

### Authentication
- Login with email/password
- User registration
- Token-based authentication with refresh
- Protected routes
- Auth state persistence

### API Integration
- Axios client with interceptors
- Automatic token refresh
- Type-safe API services
- Error handling

### Form Validation
- React Hook Form integration
- Zod schema validation
- Type-safe form inputs
- Field-level error messages

### State Management
- Zustand for client state (auth)
- TanStack Query for server state
- Optimistic updates
- Cache invalidation

## Development Patterns

### React Server Components
Use Server Components by default for better performance:
```tsx
// app/contacts/page.tsx
export default async function ContactsPage() {
  // Fetch data on server
  const contacts = await getContacts();
  return <ContactsList contacts={contacts} />;
}
```

### Client Components
Use Client Components when needed:
```tsx
'use client';

export function ContactForm() {
  const { register, handleSubmit } = useForm();
  // Interactive form logic
}
```

### API Hooks
Use custom hooks for API operations:
```tsx
const { data: contacts, isLoading } = useContacts();
const createContact = useCreateContact();
```

### Form Validation
Use Zod schemas with React Hook Form:
```tsx
const form = useForm({
  resolver: zodResolver(contactSchema),
});
```

## API Services

All API services are located in `src/lib/api/services/`:
- `auth.service.ts` - Authentication
- `contacts.service.ts` - Contact management

Add new services following the same pattern.

## Type Safety

The application maintains full TypeScript coverage:
- API types in `src/types/`
- Zod validation schemas in `src/lib/validations/`
- Type inference from schemas

## Contributing

1. Follow the established folder structure
2. Use TypeScript for all new files
3. Create Zod schemas for validation
4. Use custom hooks for data fetching
5. Follow React best practices
6. Ensure accessibility

## License

Private - All rights reserved
