# Archived Scripts

This directory contains outdated migration, test, and debug scripts that have been archived for reference but are no longer actively used in the codebase.

## Directory Structure

- **root-scripts/** - Utility scripts that were previously in the project root
- **api-scripts/** - Migration and debug scripts from the api/ directory

## Important Notes

⚠️ **Do not use these scripts in production**

These scripts may reference:
- Old database schemas that have since been migrated
- Incorrect column names (e.g., `inviting_user_id` instead of `inviting_player_id`)
- Deprecated table structures

They are kept for historical reference only.

## For Current Schema Information

Refer to:
- `DATABASE_SCHEMA_REFERENCE.md` - Production schema documentation
- `validate-database-references.js` - Schema validation tool

## Archived on

October 11, 2025

## Script Categories

### Root Scripts
- **Check/Debug**: Scripts used to investigate schema issues
- **Table Creation**: Initial table creation scripts (superseded by migrations)
- **Fix Scripts**: One-time fixes that have been applied
- **Migration Scripts**: Schema migrations that have been completed
- **Test Scripts**: Development test utilities

### API Scripts
- **Debug Scripts**: Debugging utilities for player data, stats, duels, etc.
- **Test Scripts**: API endpoint testing utilities
- **Fix Scripts**: Database constraint and foreign key fixes
- **Migration Scripts**: Schema migration utilities
