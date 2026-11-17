CREATE TABLE source_schedules (
 id text PRIMARY KEY, url text NOT NULL UNIQUE, title text NOT NULL,
 scope text NOT NULL, interval_days integer NOT NULL CHECK(interval_days BETWEEN 1 AND 90),
 enabled boolean NOT NULL DEFAULT true,
 campaign_start date, campaign_end date,
 CHECK ((campaign_start IS NULL AND campaign_end IS NULL) OR
        (campaign_start IS NOT NULL AND campaign_end IS NOT NULL AND campaign_end >= campaign_start)),
 next_check_at timestamptz NOT NULL DEFAULT now(),
 last_checked_at timestamptz, last_successful_at timestamptz, last_changed_at timestamptz,
 last_error text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_update_jobs (
 id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES source_schedules(id),
 state text NOT NULL CHECK(state IN ('queued','running','complete','failed')),
 phase text NOT NULL DEFAULT 'fetch' CHECK(phase IN ('fetch','publish')),
 attempts integer NOT NULL DEFAULT 0, run_after timestamptz NOT NULL DEFAULT now(),
 changed boolean, error text, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE UNIQUE INDEX source_update_single_active ON source_update_jobs(source_id) WHERE state IN ('queued','running');
CREATE INDEX source_update_due ON source_update_jobs(run_after) WHERE state='queued';
CREATE TABLE source_worker_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), heartbeat_at timestamptz NOT NULL
);
