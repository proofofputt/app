#!/bin/bash

# Script to run gift subscriptions migration
# This creates the necessary tables for the Zaprite integration

echo "Running gift subscriptions migration..."

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable not set"
  echo "Please set it first:"
  echo "  export DATABASE_URL='your_database_url_here'"
  exit 1
fi

# Run the migration
psql "$DATABASE_URL" -f app/database/add_subscription_gifting_tables.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
  echo ""
  echo "Verifying tables..."
  psql "$DATABASE_URL" -c "\dt subscription_bundles" -c "\dt user_gift_subscriptions"

  echo ""
  echo "Checking bundles data..."
  psql "$DATABASE_URL" -c "SELECT id, name, quantity, discount_percentage FROM subscription_bundles ORDER BY id;"
else
  echo "❌ Migration failed!"
  exit 1
fi
