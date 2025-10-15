-- Add putting distance/length configuration to competition tables
-- This will allow customizable putting distances from 3.0 to 10.0 feet

-- 1. Add putting_distance_feet column to sessions table
ALTER TABLE sessions 
ADD COLUMN putting_distance_feet DECIMAL(3,1) DEFAULT 7.0;

-- 2. Add putting_distance_feet column to duels rules (stored in JSONB rules field)
-- No schema change needed - will be stored in rules JSON

-- 3. Add putting_distance_feet column to leagues settings (stored in JSONB settings field)  
-- No schema change needed - will be stored in settings JSON

-- 4. Update all existing sessions to have default 7.0 foot distance
UPDATE sessions 
SET putting_distance_feet = 7.0 
WHERE putting_distance_feet IS NULL;

-- 5. Create index for performance on putting distance queries
CREATE INDEX idx_sessions_putting_distance ON sessions(putting_distance_feet);

-- 6. Add constraint to ensure valid putting distance range (3.0 - 10.0 feet)
ALTER TABLE sessions 
ADD CONSTRAINT check_putting_distance_range 
CHECK (putting_distance_feet >= 3.0 AND putting_distance_feet <= 10.0);

-- Verification queries
SELECT 'Sessions with putting distance' as description, COUNT(*) as count 
FROM sessions 
WHERE putting_distance_feet IS NOT NULL;

SELECT 'Putting distance distribution' as description, 
       putting_distance_feet, 
       COUNT(*) as session_count 
FROM sessions 
GROUP BY putting_distance_feet 
ORDER BY putting_distance_feet;