create extension if not exists pg_trgm with schema extensions;

create table if not exists public.jobs (
  id text primary key,
  source text not null default '',
  external_id text not null default '',
  canonical_url text not null default '',
  apply_url text not null default '',
  title text not null default '',
  company text not null default '',
  description_text text not null default '',
  location_text text not null default '',
  workplace_type text not null default '',
  employment_type text not null default '',
  salary_min numeric,
  salary_max numeric,
  salary_currency text not null default 'ZAR',
  posted_at text not null default '',
  expires_at text not null default '',
  status text not null default 'active',
  category text not null default '',
  requirements jsonb not null default '{}'::jsonb,
  content_hash text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(
      coalesce(title, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(description_text, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(location_text, '')
    )
  ) stored
);

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_source_idx on public.jobs (source);
create index if not exists jobs_posted_at_idx on public.jobs (posted_at desc);
create index if not exists jobs_location_text_idx on public.jobs (location_text);
create index if not exists jobs_search_text_trgm_idx on public.jobs using gin (search_text extensions.gin_trgm_ops);

create table if not exists public.ingestion_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  failed_count integer not null default 0,
  sources jsonb not null default '[]'::jsonb
);

create index if not exists ingestion_runs_started_at_idx on public.ingestion_runs (started_at desc);

create table if not exists public.applications (
  id text primary key,
  job_id text references public.jobs(id) on delete set null,
  kit_id text not null default '',
  status text not null default 'Started',
  method text not null default 'External',
  notes text not null default '',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  external_application_id text not null default '',
  events jsonb not null default '[]'::jsonb
);

create index if not exists applications_started_at_idx on public.applications (started_at desc);
create index if not exists applications_job_id_idx on public.applications (job_id);

alter table public.jobs enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.applications enable row level security;
