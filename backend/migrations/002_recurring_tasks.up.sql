-- 002_recurring_tasks.up.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS recurring_templates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    duration_minutes INT NOT NULL DEFAULT 60,
    color            TEXT,
    recurrence_rule  TEXT NOT NULL,
    next_run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN recurring_template_id UUID REFERENCES recurring_templates(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN recurring_event_id UUID;
ALTER TABLE tasks ADD COLUMN original_start_time TIMESTAMPTZ;

CREATE INDEX idx_tasks_recurring_template ON tasks(recurring_template_id);
CREATE INDEX idx_recurring_templates_user ON recurring_templates(user_id);
