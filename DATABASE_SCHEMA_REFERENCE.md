# Database Schema Reference

## Production Schema Column Names

This document confirms the correct column names used in the production database.

### league_invitations Table

**Correct columns:**
- `inviting_player_id` (references players.player_id)
- `invited_player_id` (references players.player_id)
- `status` (NOT invitation_status)
- `message` (NOT invitation_message)
- `invitation_method` - must be one of: 'username', 'email', 'phone'

**Note:** Do NOT use `inviting_user_id` or `invited_user_id` - these are old column names.

### league_memberships Table

**Key columns:**
- `league_id` (part of composite primary key)
- `player_id` (part of composite primary key)
- `member_role`
- `invite_permissions`
- `is_active`

**Note:** There is NO `membership_id` column. Use `(league_id, player_id)` composite key.

### Foreign Key References

All player references should use:
- `players.player_id` (NOT users.id)

## Validation

Run `validate-database-references.js` to check for incorrect column references in the codebase:

```bash
DATABASE_URL="<production-url>" node validate-database-references.js
```

## Common Mistakes to Avoid

1. ❌ `SELECT membership_id FROM league_memberships`
   ✅ `SELECT league_id, player_id FROM league_memberships`

2. ❌ `inviting_user_id` / `invited_user_id`
   ✅ `inviting_player_id` / `invited_player_id`

3. ❌ Foreign keys to `users.id`
   ✅ Foreign keys to `players.player_id`

4. ❌ `invitation_method = 'direct'`
   ✅ `invitation_method = 'username'` (or 'email' or 'phone')
