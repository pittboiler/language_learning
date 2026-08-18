-- Shared, cross-user cache for the "Have a question?" helper in the Today session's conversational steps.
-- Same idea as word_gloss (0005): the conversation is fixed content, so the FIRST resolution of a
-- (pack, conversation, question) is stored and reused by every later learner — the first asker pays the
-- LLM call, everyone after is free. Shared reference data, not per-user data.
--
-- Only the server /api/explain route touches these tables, using the service-role key (bypasses RLS).
-- RLS is enabled with NO policies so anon/auth clients cannot read or write them directly.
create table if not exists public.ai_explain (
  pack_id    text not null,
  convo_id   text not null,            -- the story id or scenario id (the whole conversation)
  question   text not null,            -- a canned grammar-concept id, or a normalized free-text question
  answer     text not null,
  model      text not null default '',
  created_at timestamptz not null default now(),
  primary key (pack_id, convo_id, question)
);

alter table public.ai_explain enable row level security;
-- (deliberately no policies — server-only via service role)

-- Per-user daily counter backing the 25/day rate limit. `day` is a UTC YYYY-MM-DD stamped server-side.
create table if not exists public.ai_ask_usage (
  user_id text not null,
  day     text not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_ask_usage enable row level security;
-- (deliberately no policies — server-only via service role)
