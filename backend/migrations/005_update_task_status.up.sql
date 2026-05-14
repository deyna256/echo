ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'postponed', 'done'));

UPDATE tasks SET status = 'todo' WHERE status = 'in_progress';
