# User Feedback System Setup Guide

## Overview

The user feedback and comments system has been implemented and is ready for deployment. This guide explains how to complete the setup.

## Database Migration Required

Before the feedback system will work in production, you need to run the database migration to create the required tables.

### Option 1: Run Migration Script (Recommended)

```bash
# Set your production DATABASE_URL environment variable
export DATABASE_URL="your-production-database-url"

# Run the migration script
node run-feedback-migration.js
```

### Option 2: Run SQL Directly

If you prefer to run the SQL directly in your database console:

1. Navigate to your Neon DB console or connect via psql
2. Copy the contents of `database/create_user_feedback_system.sql`
3. Execute the SQL commands

### Option 3: Deploy to Vercel and Run via API (For Production)

The migration can also be triggered via the Vercel environment where DATABASE_URL is already configured.

## What Gets Created

The migration creates:

### Tables

1. **feedback_threads** - Main conversation threads
   - thread_id (primary key)
   - player_id (foreign key to players)
   - subject
   - category (general_feedback, feature_request, bug_report, etc.)
   - page_location (optional)
   - feature_area (optional)
   - status (open, in_progress, resolved, closed)
   - priority (low, normal, high, critical)
   - timestamps and admin notes

2. **feedback_messages** - Individual messages within threads
   - message_id (primary key)
   - thread_id (foreign key to feedback_threads)
   - player_id (foreign key to players)
   - is_admin_response (boolean)
   - message_text
   - created_at, edited_at
   - attachments (JSONB for future use)

### Triggers

- Automatic timestamp update when new messages are added to threads

### Indexes

- Optimized indexes for common queries (player lookup, status filtering, etc.)

## Features

### User-Facing Features

- **Access**: Comments & Feedback menu item in profile dropdown (between Notifications and Logout)
- **New Feedback**: Submit feedback with category, page location, and feature area metadata
- **Thread View**: See all conversations with status filtering
- **Messaging**: Add replies to existing conversations
- **History**: Preserved conversation history for reference
- **Status Tracking**: See if feedback is open, in progress, resolved, or closed

### Categories Available

1. General Feedback
2. Feature Request
3. Bug Report
4. Page Issue
5. UI/UX Suggestion
6. Performance Issue
7. Support Request
8. Other

### Admin Features (Future Enhancement)

The system is designed to support admin responses and management:

- `is_admin_response` flag on messages
- `priority` levels for triaging
- `admin_notes` field for resolution details
- `status` transitions for workflow management

## API Endpoints

### GET /api/user-feedback
Retrieve feedback threads for authenticated user

Query parameters:
- `status` (optional): Filter by status (open, in_progress, resolved, closed)
- `thread_id` (optional): Get specific thread with all messages

### POST /api/user-feedback
Create new feedback thread

Request body:
```json
{
  "subject": "string (required)",
  "category": "string (required)",
  "page_location": "string (optional)",
  "feature_area": "string (optional)",
  "initial_message": "string (required)"
}
```

### PUT /api/user-feedback
Add message to existing thread

Request body:
```json
{
  "thread_id": "number (required)",
  "message_text": "string (required)"
}
```

## Testing the System

Once the database migration is complete:

1. Deploy the latest code to Vercel (already done via git push)
2. Log in to the web app
3. Click your profile menu
4. Select "Comments & Feedback"
5. Submit test feedback to verify the system works

## Next Steps

1. **Run the database migration** (see options above)
2. **Test the system** in production
3. **Set up admin access** (optional - future enhancement)
   - Create admin interface for responding to feedback
   - Add email notifications for new feedback
   - Implement priority-based triaging

## Welcome Message

The system includes a prominent welcome message explaining that the platform recently launched and user feedback is greatly appreciated. This sets expectations and encourages participation.

## Troubleshooting

If you encounter issues:

1. **Tables don't exist**: Run the migration
2. **Permission errors**: Check that the database user has CREATE TABLE permissions
3. **Foreign key errors**: Ensure the `players` table exists (it should already)
4. **Connection errors**: Verify DATABASE_URL environment variable is set correctly

## Files Modified/Created

- `api/user-feedback.js` - Backend API endpoint
- `database/create_user_feedback_system.sql` - Database schema
- `src/pages/CommentsPage.jsx` - Frontend component
- `src/pages/CommentsPage.css` - Styling
- `src/api.js` - API client functions
- `src/App.jsx` - Route definition
- `src/components/ProfileDropdown.jsx` - Menu item
- `run-feedback-migration.js` - Migration runner script
