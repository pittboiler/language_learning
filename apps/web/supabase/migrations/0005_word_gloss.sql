-- Shared, cross-user cache for on-demand single-word glosses (the tap-to-look-up popup).
-- Problem it fixes: words NOT in the curated pack vocab fall back to an LLM gloss that was generated
-- per browser session with no shared cache, so two partners tapping the SAME word got two independent
-- (and sometimes divergent) definitions — e.g. плаќа as "pays" for one and "cries" for the other.
-- With this table the FIRST resolution of a (pack, word, context) is stored and every later reader —
-- both partners — gets that identical stored gloss.
--
-- This is shared reference data, not per-user data. Only the server /api/gloss route touches it, using
-- the service-role key (which bypasses RLS). RLS is enabled with NO policies so anon/auth clients cannot
-- read or write it directly.
create table if not exists public.word_gloss (
  pack_id  text not null,
  word     text not null,           -- normalized surface form (see @ll/core/familiarity normalize)
  context  text not null default '',-- normalized sentence context ('' when none) — disambiguates senses
  gloss    text not null,
  translit text not null default '',
  lemma    text not null default '',
  created_at timestamptz not null default now(),
  primary key (pack_id, word, context)
);

alter table public.word_gloss enable row level security;
-- (deliberately no policies — server-only via service role)
