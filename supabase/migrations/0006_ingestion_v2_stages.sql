-- TensorLM — ingestion contract v2: stage names and transitions (task S0).
-- Spec: docs/specs/ingestion.md · contract: contracts/ingestion.json (version 2).
-- tests/rls/ingestion.test.ts checks the enum and the transition table against the contract.
--
-- Postgres can't reorder or drop enum values, so v2 keeps the v1 order: the new stages go in
-- before the v1 single pass, and that pass is renamed `parsing` → `parsing_deep` (Docling is the
-- deep pass). Existing rows in `parsing` move with the rename. The rest of the v2 schema (source
-- types, datasets, notebook insights, finalize_fast_pass) is P3.1v2's migration.
--
-- ADD VALUE may run inside the migration's transaction (Postgres 12+) as long as the new values
-- aren't used in it; the transition table below compares text, so it never casts them.

alter type public.document_stage add value if not exists 'repairing' before 'parsing';
alter type public.document_stage add value if not exists 'needs_password' before 'parsing';
alter type public.document_stage add value if not exists 'parsing_fast' before 'parsing';
alter type public.document_stage add value if not exists 'fast_ready' before 'parsing';
alter type public.document_stage rename value 'parsing' to 'parsing_deep';

-- Mirrors contracts/ingestion.json "transitions" (v2).
create or replace function public.ingest_transition_allowed(
  p_from public.document_stage,
  p_to public.document_stage
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('uploading', 'queued'), ('uploading', 'failed'),
    ('queued', 'validating'), ('queued', 'failed'),
    ('validating', 'repairing'), ('validating', 'needs_password'), ('validating', 'parsing_fast'),
    ('validating', 'parsing_deep'), ('validating', 'ocr'), ('validating', 'failed'),
    ('repairing', 'parsing_fast'), ('repairing', 'parsing_deep'), ('repairing', 'ocr'),
    ('repairing', 'failed'),
    ('needs_password', 'validating'), ('needs_password', 'failed'),
    ('parsing_fast', 'fast_ready'), ('parsing_fast', 'ocr'), ('parsing_fast', 'failed'),
    ('fast_ready', 'parsing_deep'), ('fast_ready', 'ocr'), ('fast_ready', 'reading_figures'),
    ('fast_ready', 'ready'), ('fast_ready', 'failed'),
    ('parsing_deep', 'ocr'), ('parsing_deep', 'reading_figures'), ('parsing_deep', 'indexing'),
    ('parsing_deep', 'failed'),
    ('ocr', 'fast_ready'), ('ocr', 'reading_figures'), ('ocr', 'indexing'), ('ocr', 'failed'),
    ('reading_figures', 'indexing'), ('reading_figures', 'failed'),
    ('indexing', 'ready'), ('indexing', 'failed')
  );
$$;
