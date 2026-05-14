-- 002_recurring_tasks.down.sql
ALTER TABLE tasks DROP COLUMN IF EXISTS recurring_template_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS recurring_event_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS original_start_time;
DROP TABLE IF EXISTS recurring_templates;
