DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'notifications'::regclass AND contype = 'c';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_overdue', 'task_deadline_approaching', 'goal_deadline_approaching', 'suggestion'));
