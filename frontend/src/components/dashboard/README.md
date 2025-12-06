# Dashboard Components

Comprehensive dashboard implementation for the Personal Network CRM. The dashboard provides a central hub for managing contacts, tracking follow-ups, viewing AI recommendations, and monitoring recent activity.

## Overview

The dashboard consists of 5 main widget components and a main dashboard page that orchestrates them:

```
Dashboard Page
├── Stats Row (4 StatsWidgets)
├── Left Column (2/3 width)
│   ├── PendingFollowupsWidget
│   └── RecentActivityWidget
└── Right Column (1/3 width)
    ├── AIRecommendationsWidget
    └── QuickActionsWidget
```

## Components

### 1. StatsWidget

Displays a single statistic with an icon, value, trend indicator, and optional link.

**Usage:**
```tsx
import { StatsWidget } from '@/components/dashboard';
import { Users } from 'lucide-react';

<StatsWidget
  title="Total Contacts"
  value={150}
  change={12.5}
  trend="up"
  icon={<Users className="h-5 w-5" />}
  link="/contacts"
  colorClass="text-blue-600"
/>
```

**Props:**
- `title: string` - The stat title
- `value: number` - The numeric value to display
- `change?: number` - Percentage change (e.g., 12.5 for +12.5%)
- `trend?: 'up' | 'down' | 'neutral'` - Trend direction
- `icon: React.ReactNode` - Icon component
- `link?: string` - Optional link (makes widget clickable)
- `colorClass?: string` - Tailwind color class (default: text-blue-600)

**Features:**
- Responsive design
- Hover effects
- Trend indicators with icons
- Optional clickable links

---

### 2. PendingFollowupsWidget

Displays a list of contacts due for follow-up, with quick actions to mark as done or snooze.

**Usage:**
```tsx
import { PendingFollowupsWidget } from '@/components/dashboard';

<PendingFollowupsWidget />
```

**Features:**
- Auto-fetches data using `usePendingFollowups` hook
- Shows up to 10 pending follow-ups
- Displays:
  - Contact name (clickable to profile)
  - Company
  - Last contact date
  - Relationship strength indicator (0-100%)
  - Overdue badge for past-due items
- Quick actions:
  - Mark as done (checkmark icon)
  - Snooze for 7 days (clock icon)
- Loading skeleton states
- Empty state when no pending items
- Link to full reminders page

**Color Coding:**
- Overdue: Red badge
- Relationship strength:
  - 80-100%: Green
  - 60-79%: Blue
  - 40-59%: Yellow
  - 0-39%: Orange

---

### 3. AIRecommendationsWidget

Displays AI-powered recommendations for which contacts to reach out to and why.

**Usage:**
```tsx
import { AIRecommendationsWidget } from '@/components/dashboard';

<AIRecommendationsWidget />
```

**Features:**
- Auto-fetches top 5 recommendations
- Displays:
  - Contact name and company
  - Reason for recommendation
  - Urgency score badge
  - Trigger type (Job Change, Birthday, Overdue, etc.)
- Actions:
  - Thumbs up/down feedback
  - Snooze for 7 days
  - Dismiss recommendation
- Loading skeleton states
- Empty state with CTA to connect integrations
- Link to full recommendations page

**Priority Badges:**
- High Priority (80+): Red badge
- Medium Priority (60-79): Orange badge
- Low Priority (<60): Blue badge

**Trigger Types:**
- `job_change`: LinkedIn job change detected
- `company_news`: Company in the news
- `birthday`: Contact's birthday
- `overdue`: Long time since last contact
- `general`: General recommendation

---

### 4. RecentActivityWidget

Timeline of recent activities across the CRM.

**Usage:**
```tsx
import { RecentActivityWidget } from '@/components/dashboard';

<RecentActivityWidget />
```

**Features:**
- Displays last 10 activities
- Activity types:
  - Contact added
  - Email sent
  - Meeting scheduled
  - Integration connected
  - Note added
  - Reminder completed
- Each activity shows:
  - Icon with color-coded background
  - Description with linked contact name
  - Relative timestamp ("2 hours ago")
- Infinite scroll support
- Loading skeleton states
- Empty state

**Activity Colors:**
- Contact added: Blue
- Email sent: Purple
- Meeting: Green
- Integration connected: Orange
- Note added: Gray
- Reminder completed: Teal

---

### 5. QuickActionsWidget

Grid of common action buttons for quick access.

**Usage:**
```tsx
import { QuickActionsWidget } from '@/components/dashboard';

<QuickActionsWidget />
```

**Actions:**
1. Add Contact → `/contacts/new`
2. Import Contacts → `/settings/integrations`
3. View Reminders → `/reminders`
4. Search → Focuses global search bar
5. Calendar View → `/calendar`
6. Settings → `/settings`

**Features:**
- 2-column grid on mobile, responsive
- Icon + text for each action
- Hover effects with shadows
- Color-coded icons

---

## Dashboard Page

The main dashboard page (`/app/dashboard/page.tsx`) orchestrates all widgets.

**Features:**
- Protected route (requires authentication)
- Personalized greeting based on time of day
- 4 stat cards in top row
- 2-column layout (2/3 left, 1/3 right)
- Responsive design (stacks on mobile)
- Navigation bar with user info and logout

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Header: "Good morning, {user.name}"                │
├─────────────────────────────────────────────────────┤
│  [Total] [Due Today] [Overdue] [New This Week]     │
├──────────────────┬──────────────────────────────────┤
│                  │                                  │
│  Pending         │  AI Recommendations              │
│  Follow-ups      │  (Top 5 suggestions)             │
│  (Due Today)     │                                  │
│                  ├──────────────────────────────────┤
├──────────────────┤  Quick Actions                   │
│  Recent          │  [+ Add Contact]                 │
│  Activity        │  [Import Contacts]               │
│  (Timeline)      │  [View All Reminders]            │
└──────────────────┴──────────────────────────────────┘
```

---

## Hooks

### useDashboardData

Main hook that fetches all dashboard data.

```tsx
import { useDashboardData } from '@/hooks';

const {
  stats,
  pendingFollowups,
  recommendations,
  recentActivity,
  isLoading,
  isError,
} = useDashboardData();
```

**Individual Hooks:**
- `useDashboardStats()` - Get stats (total contacts, due today, etc.)
- `usePendingFollowups(params)` - Get pending follow-ups
- `useRecommendations(params)` - Get AI recommendations
- `useRecentActivity(params)` - Get recent activity

**Mutation Hooks:**
- `useDismissRecommendation()` - Dismiss a recommendation
- `useSnoozeRecommendation()` - Snooze a recommendation
- `useFeedbackRecommendation()` - Provide feedback
- `useMarkFollowupDone()` - Mark follow-up as complete
- `useSnoozeFollowup()` - Snooze a follow-up

---

## API Endpoints

The dashboard uses the following backend endpoints:

### GET `/api/v1/dashboard/stats`
Returns dashboard statistics.

**Response:**
```json
{
  "totalContacts": 150,
  "dueToday": 5,
  "overdue": 2,
  "newThisWeek": 8,
  "contactsChange": 12.5,
  "dueTodayChange": -10.0,
  "overdueChange": 50.0,
  "newThisWeekChange": 33.3
}
```

### GET `/api/v1/dashboard/followups?limit=10&includeOverdue=true`
Returns pending follow-ups.

**Query Params:**
- `limit` (default: 10)
- `includeOverdue` (default: false)

**Response:**
```json
[
  {
    "id": "followup-123",
    "contact": {
      "id": "contact-456",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "company": "Acme Inc"
    },
    "dueDate": "2025-11-30T00:00:00Z",
    "lastContactedAt": "2025-10-15T10:30:00Z",
    "relationshipStrength": 75,
    "reminderFrequency": "monthly",
    "isPastDue": false
  }
]
```

### GET `/api/v1/dashboard/recommendations?period=daily&limit=5`
Returns AI recommendations.

**Query Params:**
- `period`: daily | weekly | monthly (default: daily)
- `limit` (default: 5)

**Response:**
```json
[
  {
    "id": "rec-789",
    "contactId": "contact-456",
    "contact": {
      "id": "contact-456",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Inc"
    },
    "reason": "John recently changed jobs to Acme Inc. This is a great time to reach out and congratulate him!",
    "urgencyScore": 85,
    "triggerType": "job_change",
    "createdAt": "2025-11-30T08:00:00Z"
  }
]
```

### GET `/api/v1/dashboard/activity?limit=10&offset=0`
Returns recent activity.

**Response:**
```json
[
  {
    "id": "activity-123",
    "type": "contact_added",
    "description": "Added new contact",
    "timestamp": "2025-11-30T10:30:00Z",
    "contactId": "contact-456",
    "contact": {
      "id": "contact-456",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
]
```

### POST `/api/v1/dashboard/recommendations/:id/dismiss`
Dismiss a recommendation.

### POST `/api/v1/dashboard/recommendations/:id/snooze`
Snooze a recommendation.

**Body:**
```json
{
  "days": 7
}
```

### POST `/api/v1/dashboard/recommendations/:id/feedback`
Provide feedback.

**Body:**
```json
{
  "isHelpful": true
}
```

### POST `/api/v1/dashboard/followups/:id/complete`
Mark follow-up as done.

### POST `/api/v1/dashboard/followups/:id/snooze`
Snooze a follow-up.

**Body:**
```json
{
  "days": 7
}
```

---

## Customization

### Changing Widget Order

Edit `/app/dashboard/page.tsx`:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2 space-y-6">
    {/* Change order or add/remove widgets */}
    <RecentActivityWidget />
    <PendingFollowupsWidget />
  </div>
  <div className="space-y-6">
    <QuickActionsWidget />
    <AIRecommendationsWidget />
  </div>
</div>
```

### Customizing Colors

Edit the `colorClass` prop on `StatsWidget`:

```tsx
<StatsWidget
  title="Total Contacts"
  value={stats?.totalContacts || 0}
  colorClass="text-purple-600" // Change color
  // ...
/>
```

### Adding New Quick Actions

Edit `QuickActionsWidget.tsx`:

```tsx
const actions = [
  // ... existing actions
  {
    icon: <YourIcon className="h-5 w-5" />,
    label: 'New Action',
    description: 'Description',
    href: '/your-route',
    color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
  },
];
```

### Customizing Widget Limits

Change the query parameters in hooks:

```tsx
const pendingFollowups = usePendingFollowups({ limit: 20 }); // Show 20 instead of 10
const recommendations = useRecommendations({ period: 'weekly', limit: 10 }); // Weekly, 10 items
```

---

## Accessibility

All components follow WCAG 2.1 AA standards:

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios meet AA standards
- Focus indicators on all interactive elements

**Keyboard Shortcuts:**
- `Tab` - Navigate between widgets and actions
- `Enter/Space` - Activate buttons and links
- `Esc` - Close modals (if any)

---

## Performance Optimization

### Query Caching

React Query automatically caches all dashboard data:

- Stats: 5-minute cache
- Pending followups: 2-minute cache
- Recommendations: 5-minute cache
- Recent activity: 1-minute cache

### Loading States

All widgets implement skeleton loading states for better UX during data fetching.

### Optimistic Updates

Mutations (mark done, dismiss, snooze) trigger optimistic updates and cache invalidation.

---

## Troubleshooting

### Widgets showing empty states

1. Check if backend endpoints are running
2. Verify authentication token is valid
3. Check browser console for API errors
4. Ensure backend database has data

### Stats not updating

1. Check cache settings in hooks
2. Manually invalidate queries: `queryClient.invalidateQueries(['dashboard'])`
3. Check if mutations are properly invalidating caches

### Styling issues

1. Ensure Tailwind CSS is properly configured
2. Check if shadcn/ui components are installed
3. Verify `cn()` utility is working

---

## Future Enhancements

Potential improvements:

1. **Drag-and-drop widget reordering** - Allow users to customize layout
2. **Widget size customization** - Expand/collapse widgets
3. **Export dashboard as PDF** - For reporting
4. **Real-time updates** - WebSocket integration for live data
5. **Custom widget creation** - User-defined widgets
6. **Dark mode support** - Theme switching
7. **Mobile app** - React Native dashboard
8. **Advanced filters** - Filter by tags, date ranges, etc.

---

## Support

For issues or questions:

1. Check this README
2. Review component source code
3. Check API endpoint responses
4. Review browser console for errors
5. Contact development team

---

**Last Updated:** 2025-11-30
**Version:** 1.0.0
