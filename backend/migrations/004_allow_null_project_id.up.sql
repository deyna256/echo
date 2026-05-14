-- 004_allow_null_project_id.up.sql
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;