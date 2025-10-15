-- Consolidate Notifications Migration
-- Merges user_notifications and league_notifications into unified notifications table
-- Run this migration to establish single source of truth for all notifications

-- Step 1: Ensure notifications table exists with correct schema
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link_path VARCHAR(500),
  data JSONB DEFAULT '{}',
  read_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_player_created
ON notifications(player_id, created_at DESC);

-- Step 3: Migrate data from user_notifications if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_notifications') THEN

    -- Insert user notifications into unified table
    INSERT INTO notifications (player_id, type, title, message, link_path, data, read_status, created_at)
    SELECT
      user_id as player_id,
      notification_type as type,
      title,
      message,
      COALESCE(data->>'link_path', NULL) as link_path,
      COALESCE(data, '{}') as data,
      COALESCE(is_read, false) as read_status,
      COALESCE(created_at, NOW()) as created_at
    FROM user_notifications
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Migrated % rows from user_notifications',
      (SELECT COUNT(*) FROM user_notifications);

  END IF;
END $$;

-- Step 4: Migrate data from league_notifications if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_notifications') THEN

    -- Insert league notifications into unified table
    INSERT INTO notifications (player_id, type, title, message, link_path, data, read_status, created_at)
    SELECT
      user_id as player_id,
      notification_type as type,
      title,
      message,
      COALESCE(data->>'link_path', CONCAT('/leagues/', league_id::text)) as link_path,
      jsonb_build_object(
        'league_id', league_id,
        'original_data', COALESCE(data, '{}')
      ) as data,
      COALESCE(is_read, false) as read_status,
      COALESCE(created_at, NOW()) as created_at
    FROM league_notifications
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Migrated % rows from league_notifications',
      (SELECT COUNT(*) FROM league_notifications);

  END IF;
END $$;

-- Step 5: Backup old tables before dropping (rename with _backup suffix)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_notifications') THEN
    ALTER TABLE user_notifications RENAME TO user_notifications_backup;
    RAISE NOTICE 'Renamed user_notifications to user_notifications_backup';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_notifications') THEN
    ALTER TABLE league_notifications RENAME TO league_notifications_backup;
    RAISE NOTICE 'Renamed league_notifications to league_notifications_backup';
  END IF;
END $$;

-- Step 6: Create helpful view for notification statistics
CREATE OR REPLACE VIEW notification_stats AS
SELECT
  player_id,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN read_status = false THEN 1 END) as unread_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today_count,
  COUNT(CASE WHEN type = 'duel_challenge' THEN 1 END) as duel_notifications,
  COUNT(CASE WHEN type = 'league_invitation' THEN 1 END) as league_notifications,
  COUNT(CASE WHEN type = 'achievement' THEN 1 END) as achievement_notifications,
  MAX(created_at) as last_notification_at
FROM notifications
GROUP BY player_id;

-- Step 7: Summary report
DO $$
DECLARE
  total_count INTEGER;
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(CASE WHEN read_status = false THEN 1 END)
  INTO total_count, unread_count
  FROM notifications;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Notification Consolidation Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total notifications: %', total_count;
  RAISE NOTICE 'Unread notifications: %', unread_count;
  RAISE NOTICE 'Backup tables: user_notifications_backup, league_notifications_backup';
  RAISE NOTICE 'New unified table: notifications';
  RAISE NOTICE 'Stats view created: notification_stats';
  RAISE NOTICE '========================================';
END $$;

-- Optional: Uncomment to permanently drop backup tables after verification
-- DROP TABLE IF EXISTS user_notifications_backup;
-- DROP TABLE IF EXISTS league_notifications_backup;
