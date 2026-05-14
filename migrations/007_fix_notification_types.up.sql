DO $$
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_overdue', 'task_deadline_approaching', 'goal_deadline_approaching', 'suggestion'));
