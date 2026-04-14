-- Add GUARDIAN to UserRole if missing (DB may already have it from manual changes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'GUARDIAN'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'GUARDIAN';
  END IF;
END $$;
