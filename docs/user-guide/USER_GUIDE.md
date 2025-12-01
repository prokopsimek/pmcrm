# Personal Network CRM - User Guide

**Version:** 1.0.0
**Last Updated:** November 30, 2025

Welcome to Personal Network CRM! This guide will help you get the most out of your AI-powered relationship management platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Contacts Management](#contacts-management)
3. [Integrations](#integrations)
4. [Reminders & Follow-ups](#reminders--follow-ups)
5. [AI Features](#ai-features)
6. [Dashboard](#dashboard)
7. [Settings](#settings)
8. [FAQs](#faqs)

---

## Getting Started

### Introduction

Personal Network CRM helps professionals manage their business relationships effortlessly through:

- **AI-Powered Recommendations**: Smart suggestions for who to reach out to and when
- **Intelligent Integrations**: Sync contacts from Google, Microsoft 365, and email
- **Automated Reminders**: Never miss important follow-ups
- **Semantic Search**: Find contacts using natural language
- **Privacy-First Design**: GDPR compliant with end-to-end encryption

### Creating an Account

1. **Visit the Application**
   - Navigate to [https://app.personalnetworkcrm.com](https://app.personalnetworkcrm.com)

2. **Choose Sign-Up Method**
   - **Email & Password**: Click "Sign Up" and enter your details
   - **Google OAuth**: Click "Continue with Google"
   - **Microsoft OAuth**: Click "Continue with Microsoft"

3. **Verify Your Email** (Email sign-up only)
   - Check your inbox for a verification email
   - Click the verification link
   - You'll be redirected to the login page

4. **Set Up Multi-Factor Authentication** (Recommended)
   - Navigate to Settings > Security
   - Click "Enable MFA"
   - Scan the QR code with your authenticator app
   - Enter the 6-digit code to verify

### Completing Onboarding

The onboarding wizard helps you set up your account in 5 easy steps:

**Step 1: Profile Setup**
- Enter your full name
- Add your job title
- Upload a profile picture (optional)
- Add your company name

**Step 2: Workspace Creation**
- Choose your workspace name (e.g., "John's Network")
- Select your industry
- Set your timezone
- Choose your preferred language

**Step 3: Import Preferences**
- Select which sources you want to import from:
  - Google Contacts
  - Microsoft 365
  - Manual entry only
- Skip this step if you want to add contacts manually

**Step 4: Reminder Settings**
- Set default reminder frequency for contacts
  - Weekly
  - Bi-weekly
  - Monthly
  - Quarterly
  - Custom
- Choose notification preferences
  - Email reminders
  - In-app notifications
  - Push notifications (mobile)

**Step 5: AI Preferences**
- Enable AI recommendations
- Set recommendation frequency
- Choose AI insights level (Basic/Advanced)
- Review and accept AI terms

### Dashboard Overview

Your dashboard provides a comprehensive view of your network:

**Key Metrics Widget**
- Total contacts
- Contacts added this week
- Pending follow-ups
- Active integrations

**Quick Actions Panel**
- Add new contact
- Import contacts
- Schedule reminder
- Search contacts

**Activity Timeline**
- Recent contact interactions
- Upcoming reminders
- AI recommendations
- Integration sync status

**Follow-Up Queue**
- Contacts requiring attention
- Overdue follow-ups
- Snoozed reminders

---

## Contacts Management

### Adding Contacts Manually

**To add a single contact:**

1. Click the "Add Contact" button in the top right or dashboard
2. Fill in the contact details:
   - **Required**: First name, last name
   - **Optional**:
     - Email address(es)
     - Phone number(s)
     - Company and job title
     - Location
     - Social media profiles (LinkedIn, Twitter, etc.)
     - Notes
     - Tags
3. Set reminder frequency (optional)
4. Click "Save Contact"

**Tips for Better Contact Management:**
- Add notes about how you met the person
- Use tags to organize contacts (e.g., "Client", "Investor", "Friend")
- Include preferred contact method in notes
- Add birthdays and important dates

### Importing from Google Contacts

**Initial Setup:**

1. Navigate to **Settings > Integrations**
2. Click "Connect Google Contacts"
3. Sign in to your Google account
4. Review and authorize the requested permissions:
   - Read your contacts
   - Read and write your contacts (for bidirectional sync)
5. Click "Allow"

**Import Process:**

1. After authorization, you'll see the import wizard
2. **Select Contacts to Import**:
   - All contacts
   - Contacts from specific groups
   - Contacts modified since [date]
3. **Map Contact Fields**:
   - Review automatic field mapping
   - Adjust custom field mappings if needed
4. **Handle Duplicates**:
   - Skip duplicates
   - Update existing contacts
   - Keep both versions
5. **Tag Imported Contacts** (optional):
   - Add tags like "Google Import 2025"
6. Click "Start Import"

**Import Progress:**
- You'll see a progress bar during import
- Large imports may take several minutes
- You can continue using the app during import
- You'll receive a notification when complete

**Sync Settings:**
- **One-way sync**: Google → CRM only
- **Two-way sync**: Changes sync in both directions
- **Sync frequency**: Manual, Hourly, Daily
- **Field preferences**: Choose which fields to sync

### Importing from Microsoft 365

**Initial Setup:**

1. Navigate to **Settings > Integrations**
2. Click "Connect Microsoft 365"
3. Sign in to your Microsoft account
4. Authorize the following permissions:
   - Contacts.Read
   - Contacts.ReadWrite (for bidirectional sync)
   - Calendars.Read (for calendar sync)
5. Click "Accept"

**Import Process:**

Similar to Google Contacts import:

1. Select contacts to import (All, Specific folders, Date range)
2. Review field mappings
3. Configure duplicate handling
4. Add import tags
5. Start import

**Microsoft-Specific Features:**
- Import from Outlook folders
- Sync calendar events
- Import Exchange contacts
- Corporate directory integration (if enabled)

### Organizing with Tags

Tags help you categorize and filter contacts efficiently.

**Creating Tags:**
1. Go to **Settings > Tags**
2. Click "Create New Tag"
3. Enter tag name (e.g., "VIP Client", "Needs Follow-up")
4. Choose a color
5. Click "Save"

**Applying Tags:**
- **During contact creation**: Select tags from dropdown
- **From contact view**: Click "Edit" > Add tags
- **Bulk tagging**: Select multiple contacts > "Add Tag"

**Tag Best Practices:**
- Use hierarchical tags (e.g., "Client/Active", "Client/Inactive")
- Create tags for relationship types
- Use tags for follow-up status
- Combine tags with search for powerful filtering

### Search and Filters

**Basic Search:**
- Click the search bar at the top
- Type contact name, email, or company
- Results appear as you type
- Click a result to view the contact

**Advanced Filters:**

1. Click "Filters" next to the search bar
2. Apply multiple criteria:
   - **Tags**: Filter by one or more tags
   - **Company**: Show contacts from specific companies
   - **Location**: Filter by city or country
   - **Last Contact**: Contacts not contacted in X days
   - **Reminder Status**: Pending, Overdue, Completed
   - **Source**: Imported from specific integration
3. Click "Apply Filters"
4. Save filter combinations as "Smart Lists"

**Semantic Search:**

Our AI-powered semantic search understands natural language:

- "Investors I met in 2024"
- "Contacts in San Francisco working in tech"
- "People I haven't spoken to in 3 months"
- "Clients who need follow-up"

**Search Tips:**
- Use quotes for exact phrases
- Combine filters with search
- Save frequently used searches
- Use semantic search for complex queries

### Deduplication

**Automatic Deduplication:**

During import, the system automatically:
- Detects potential duplicates based on:
  - Email address match
  - Name similarity (fuzzy matching)
  - Phone number match
- Presents merge suggestions
- Allows you to review before merging

**Manual Deduplication:**

1. Go to **Settings > Data Management > Duplicates**
2. Review suggested duplicates
3. For each duplicate pair:
   - **Merge**: Combine both records (choose primary)
   - **Keep Both**: Mark as different people
   - **Dismiss**: Not duplicates
4. Click "Merge Selected"

**Merge Strategy:**
- Primary contact keeps all unique data
- Duplicate contact data is merged in
- Tags from both contacts are combined
- Activity history is preserved
- Notes are concatenated

---

## Integrations

### Connecting Google Contacts

See [Importing from Google Contacts](#importing-from-google-contacts) for detailed setup.

**Managing Your Connection:**
- View sync status in Settings > Integrations
- Pause/Resume sync
- Change sync frequency
- Review sync logs
- Disconnect integration

**Troubleshooting:**
- **Sync failed**: Check internet connection, re-authorize if needed
- **Missing contacts**: Verify Google permissions
- **Duplicate contacts**: Review deduplication settings

### Connecting Microsoft 365

See [Importing from Microsoft 365](#importing-from-microsoft-365) for detailed setup.

**Additional Features:**
- Outlook calendar integration
- Exchange server support
- Corporate directory access
- Teams integration (coming soon)

### Email Sync (Gmail/Outlook)

**Gmail Sync:**

1. Navigate to **Settings > Integrations > Email**
2. Click "Connect Gmail"
3. Authorize Gmail permissions:
   - Read email messages
   - Read email metadata
4. Configure sync settings:
   - Track email interactions
   - Auto-create contacts from email
   - Link emails to existing contacts
5. Click "Start Sync"

**Outlook Sync:**

1. Navigate to **Settings > Integrations > Email**
2. Click "Connect Outlook"
3. Sign in to Microsoft
4. Authorize permissions
5. Configure sync preferences
6. Click "Start Sync"

**Email Tracking Features:**
- Automatically log email interactions
- See email history in contact timeline
- Track email frequency
- Identify communication gaps
- Set reminders based on last email

**Privacy Note:** We only store email metadata (subject, date, participants), not email content.

### Calendar Sync

**Google Calendar:**

1. Navigate to **Settings > Integrations > Calendar**
2. Click "Connect Google Calendar"
3. Authorize calendar permissions
4. Select calendars to sync
5. Configure event tracking:
   - Track meetings with contacts
   - Auto-update last contact date
   - Create follow-up reminders after meetings

**Microsoft Calendar:**

1. Navigate to **Settings > Integrations > Calendar**
2. Click "Connect Microsoft Calendar"
3. Authorize permissions
4. Select calendars to sync
5. Configure tracking preferences

**Calendar Features:**
- See upcoming meetings with contacts
- Track meeting frequency
- Auto-suggest follow-ups after meetings
- View contact availability

### Managing Integrations

**Integration Dashboard:**

Navigate to **Settings > Integrations** to view:
- All connected services
- Sync status and last sync time
- Data usage per integration
- Error logs

**For Each Integration:**
- **Pause/Resume**: Temporarily stop syncing
- **Sync Now**: Force immediate sync
- **Configure**: Change sync settings
- **View Logs**: See sync history
- **Disconnect**: Remove integration

**Best Practices:**
- Regularly review sync logs
- Monitor data usage
- Keep integrations up to date
- Re-authorize if permissions change

---

## Reminders & Follow-ups

### Setting Reminder Frequency

**Contact-Level Reminders:**

1. Open a contact
2. Click "Edit"
3. Scroll to "Reminder Settings"
4. Choose frequency:
   - Never
   - Weekly
   - Bi-weekly
   - Monthly
   - Quarterly
   - Custom (e.g., every 45 days)
5. Click "Save"

**Bulk Reminder Setup:**

1. Select multiple contacts
2. Click "Actions" > "Set Reminders"
3. Choose frequency
4. Click "Apply to Selected"

**Conditional Reminders:**

Create smart reminders based on:
- Contact tags
- Last interaction date
- Contact importance
- Custom rules

### Viewing Pending Follow-ups

**Follow-Up Dashboard:**

Navigate to **Dashboard > Follow-Ups** to see:

**Today's Follow-Ups:**
- Contacts to reach out to today
- Overdue follow-ups
- Quick action buttons

**This Week:**
- Upcoming follow-ups
- Suggested contacts
- Relationship health alerts

**Overdue:**
- Missed follow-ups
- Days overdue
- Priority indicators

**Filtered Views:**
- By tag
- By importance
- By last contact date

### Snoozing Reminders

**To Snooze a Reminder:**

1. Open the reminder notification
2. Click "Snooze"
3. Choose snooze duration:
   - 1 day
   - 3 days
   - 1 week
   - 2 weeks
   - Custom date
4. Add snooze reason (optional)
5. Click "Confirm"

**Snooze History:**
- View in contact timeline
- Track snooze patterns
- AI learns from your snooze behavior

### Marking as Done

**Complete a Follow-Up:**

1. Open the reminder or follow-up
2. Click "Mark as Done"
3. (Optional) Add notes about the interaction:
   - Call
   - Email
   - Meeting
   - Message
4. (Optional) Log interaction details
5. Click "Complete"

**Quick Complete:**
- Click checkmark on reminder
- Swipe right on mobile
- Use keyboard shortcut (Cmd+Enter)

**Completion Stats:**
- Track completion rate
- See follow-up trends
- Identify neglected contacts

---

## AI Features

### Understanding AI Recommendations

Personal Network CRM uses AI to help you maintain relationships proactively.

**Types of Recommendations:**

**1. Contact Suggestions**
- "Reach out to [Name] - you haven't spoken in 3 months"
- Based on relationship strength and decay
- Considers historical communication patterns

**2. Timing Suggestions**
- "Best time to contact [Name]: Tuesday mornings"
- Analyzes past response patterns
- Optimizes for engagement

**3. Context Suggestions**
- "Congratulate [Name] on their new job"
- "Follow up on project discussion from last month"
- Monitors social media and public updates

**4. Relationship Insights**
- "Your relationship with [Name] is weakening"
- "Strong connection with [Name] - consider introduction to [Other Name]"
- Network mapping and analysis

**How AI Works:**

Our AI analyzes:
- Communication frequency and recency
- Interaction quality (email responses, meeting length)
- Social media activity
- Calendar events
- Contact importance (tags, manual ratings)
- Your behavior patterns

**Recommendation Score:**
- High Priority (Red): Action needed soon
- Medium Priority (Yellow): Consider in next week
- Low Priority (Green): Optional, but beneficial

### Dismissing Recommendations

**To Dismiss a Recommendation:**

1. Open the recommendation
2. Click "Dismiss"
3. (Optional) Select reason:
   - Already contacted
   - Not relevant
   - Incorrect suggestion
   - Relationship ended
4. Click "Confirm"

**Effect of Dismissing:**
- AI learns from your feedback
- Future recommendations improve
- Contact priority may adjust
- Recommendation won't reappear for this context

**Bulk Dismiss:**
- Select multiple recommendations
- Click "Dismiss All"
- Provide feedback (optional)

### Providing Feedback

Help improve AI recommendations:

**Thumbs Up/Down:**
- Click thumbs up for helpful suggestions
- Click thumbs down for poor suggestions
- Improves future recommendations

**Detailed Feedback:**

1. Click feedback icon on recommendation
2. Rate accuracy (1-5 stars)
3. Provide comments:
   - What was helpful?
   - What was incorrect?
   - What was missing?
4. Submit feedback

**Feedback Impact:**
- Personalizes AI to your networking style
- Improves recommendation quality
- Helps us improve the product

### Semantic Search

**What is Semantic Search?**

Unlike traditional keyword search, semantic search understands the meaning and context of your queries.

**Example Queries:**

Traditional: "john smith"
Semantic: "investors I met at conferences in 2024"

Traditional: "tag:client"
Semantic: "clients I haven't emailed in over a month"

Traditional: "san francisco"
Semantic: "people in tech hubs on the west coast"

**How to Use Semantic Search:**

1. Click the search bar
2. Toggle "Semantic Search" (magic wand icon)
3. Type your query in natural language
4. View results ranked by relevance

**Advanced Queries:**

- "Find similar contacts to [Name]"
- "Who should I introduce to [Name]?"
- "Show me contacts interested in [Topic]"
- "Find potential clients in [Industry]"

**Tips for Best Results:**
- Be specific but natural
- Include context (time, location, industry)
- Use complete sentences
- Combine with filters for precision

---

## Dashboard

### Understanding Widgets

Your dashboard consists of customizable widgets:

**Contacts Overview Widget**
- Total contacts
- Growth trends
- Active vs. inactive
- Import sources breakdown

**Follow-Up Queue Widget**
- Today's follow-ups
- This week's follow-ups
- Overdue count
- Completion rate

**AI Recommendations Widget**
- Top 5 recommended actions
- New recommendations
- Dismissed count
- Success rate

**Activity Timeline Widget**
- Recent interactions
- Sync events
- System notifications
- Important updates

**Network Health Widget**
- Relationship strength distribution
- Communication frequency
- Neglected contacts alert
- Network growth rate

**Quick Stats Widget**
- Emails sent/received this week
- Meetings this week
- New contacts added
- Tags most used

### Quick Actions

**Add Contact**
- One-click contact creation
- Quick form with essential fields
- Save and add another option

**Import Contacts**
- Quick access to import wizard
- Resume incomplete imports
- View import history

**Schedule Reminder**
- Create one-off reminder
- Set recurring reminder
- Bulk reminder setup

**Search Contacts**
- Quick search bar
- Recently viewed contacts
- Saved searches

**Customize Dashboard**
- Click "Customize" in top right
- Drag and drop widgets
- Resize widgets
- Hide/show widgets
- Reset to default

### Activity Timeline

The activity timeline shows all network activities:

**Activity Types:**

- **Contact Added**: New contact created or imported
- **Contact Updated**: Changes to contact information
- **Email Sent/Received**: Email interactions
- **Meeting Scheduled/Completed**: Calendar events
- **Reminder Completed**: Follow-up marked as done
- **Tag Added/Removed**: Contact organization changes
- **Note Added**: New note on contact
- **Integration Sync**: Automatic sync events
- **AI Recommendation**: New AI suggestion

**Timeline Features:**
- Filter by activity type
- Search timeline
- Export timeline
- Group by contact or date

**Timeline Insights:**
- Most active contacts
- Communication patterns
- Busiest times
- Relationship trends

---

## Settings

### Profile Management

**Edit Your Profile:**

1. Click your avatar in top right
2. Select "Profile Settings"
3. Update information:
   - Profile picture
   - Full name
   - Email address
   - Phone number
   - Job title
   - Company
   - Bio
4. Click "Save Changes"

**Email Preferences:**
1. Navigate to **Settings > Profile > Email**
2. Update:
   - Primary email
   - Add secondary emails
   - Email signature
   - Display name
3. Verify new emails

**Password Management:**
1. Navigate to **Settings > Security > Password**
2. Enter current password
3. Enter new password
4. Confirm new password
5. Click "Update Password"

**Delete Account:**
1. Navigate to **Settings > Profile > Danger Zone**
2. Click "Delete Account"
3. Review consequences
4. Enter password to confirm
5. Click "Permanently Delete Account"

Note: Account deletion is irreversible and GDPR compliant.

### Workspace Settings

**Workspace Information:**
- Workspace name
- Industry
- Timezone
- Language
- Date format
- Currency

**Team Management** (Team/Enterprise plans):
- Invite team members
- Manage roles and permissions
- View team activity
- Set team defaults

**Workspace Limits:**
- Current plan
- Contact limit
- Storage usage
- API usage
- Integration count

**Billing:**
- Current plan
- Payment method
- Billing history
- Upgrade/downgrade plan

### Privacy Settings

**Data Privacy:**

1. Navigate to **Settings > Privacy**
2. Configure:
   - **Profile Visibility**: Who can see your profile
   - **Activity Sharing**: Share activity with team
   - **Data Export**: Download your data
   - **Data Deletion**: Request data deletion

**Cookie Preferences:**
- Essential cookies (required)
- Analytics cookies (optional)
- Marketing cookies (optional)

**Third-Party Access:**
- Connected applications
- API access tokens
- OAuth authorizations
- Revoke access

**GDPR Rights:**
- Right to access (export data)
- Right to erasure (delete account)
- Right to rectification (edit data)
- Right to portability (export in standard format)
- Right to object (opt-out of processing)

### Notification Preferences

**Email Notifications:**

1. Navigate to **Settings > Notifications > Email**
2. Toggle notifications:
   - Reminder notifications
   - AI recommendations
   - Integration sync status
   - Team activity
   - Product updates
   - Security alerts

**In-App Notifications:**
- Follow-up reminders
- AI suggestions
- Sync completions
- Errors and warnings

**Push Notifications** (Mobile):
- Daily digest
- Immediate reminders
- Urgent follow-ups
- Custom notifications

**Notification Schedule:**
- Quiet hours (no notifications)
- Daily digest time
- Frequency caps
- Priority filtering

**Notification Channels:**
- Email
- In-app
- Push (mobile)
- SMS (premium)
- Webhook (API)

---

## FAQs

### Common Questions

**Q: How do I import contacts from iPhone/iCloud?**
A: Apple doesn't provide a direct API. Export your contacts as VCF from iCloud.com, then import the file using our "Import from File" feature.

**Q: Can I undo a contact merge?**
A: Yes, within 30 days. Go to Settings > Data Management > Recent Changes and click "Undo Merge."

**Q: How does the AI decide who to recommend?**
A: Our AI considers communication frequency, recency, relationship strength, historical patterns, and your networking goals.

**Q: Is my data encrypted?**
A: Yes. All data is encrypted at rest (AES-256-GCM) and in transit (TLS 1.3). PII fields have additional encryption.

**Q: Can I use this for team collaboration?**
A: Yes, upgrade to Team plan to share contacts, assign follow-ups, and collaborate with teammates.

**Q: What happens if I delete a contact?**
A: Deleted contacts go to trash for 30 days. After that, they're permanently deleted and can't be recovered.

**Q: How do I export my data?**
A: Navigate to Settings > Privacy > Export Data. Choose format (CSV, JSON, VCF) and download.

**Q: Can I customize reminder frequencies per contact?**
A: Yes, each contact can have its own reminder frequency. Edit the contact and set custom reminder schedule.

**Q: Does the app work offline?**
A: The web app requires internet. Mobile app (coming soon) will support offline viewing with sync when back online.

**Q: How do I cancel my subscription?**
A: Navigate to Settings > Billing > Cancel Subscription. Your data is retained for 90 days after cancellation.

### Troubleshooting

**Problem: Google Contacts sync failed**
- Check internet connection
- Re-authorize Google integration
- Verify Google account has contacts
- Check sync logs for specific errors
- Contact support if issue persists

**Problem: Can't find imported contacts**
- Check filters (clear all filters)
- Verify import completed (Settings > Integrations > Import History)
- Search for known contact name
- Check deduplication settings

**Problem: AI recommendations not appearing**
- Enable AI features in Settings > AI
- Ensure you have sufficient contact history
- Check if AI recommendation frequency is set
- Verify contacts have reminder frequencies set

**Problem: Email sync not tracking interactions**
- Verify email integration is connected
- Check email permissions are granted
- Ensure "Track Interactions" is enabled
- Check that contact has correct email address

**Problem: Mobile app push notifications not working**
- Enable notifications in device settings
- Check app notification permissions
- Verify notifications are enabled in app settings
- Restart the app

**Problem: Can't delete a contact**
- Check if you have permission (team member limitations)
- Ensure contact is not protected
- Try removing tags first
- Contact support if error persists

**Problem: Dashboard loading slowly**
- Clear browser cache
- Disable browser extensions
- Check internet connection speed
- Try different browser
- Contact support if persistent

### Getting Help

**Support Channels:**

**Email Support**: support@personalnetworkcrm.com
Response time: 24-48 hours (business days)

**Live Chat**: Available in-app, Mon-Fri 9AM-6PM EST
Click chat icon in bottom right

**Help Center**: [https://help.personalnetworkcrm.com](https://help.personalnetworkcrm.com)
Comprehensive articles and video tutorials

**Community Forum**: [https://community.personalnetworkcrm.com](https://community.personalnetworkcrm.com)
Get help from other users

**Status Page**: [https://status.personalnetworkcrm.com](https://status.personalnetworkcrm.com)
Check service status

**Feature Requests**: [https://feedback.personalnetworkcrm.com](https://feedback.personalnetworkcrm.com)
Vote on upcoming features

**Emergency Support** (Enterprise only): +1-800-NETWORK
24/7 phone support for critical issues

---

**Thank you for using Personal Network CRM!**

We're constantly improving based on your feedback. If you have suggestions, please reach out via any support channel.

*Last updated: November 30, 2025*
