-- 004_allow_null_project_id.down.sql
ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL;