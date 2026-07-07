-- Defense-in-depth against concurrent/duplicate runs (see actions.ts
-- idempotencyKey enqueue): the evidence extraction step already de-dupes in
-- memory and rebuilds evidence_items from a clean slate, so this should never
-- fire in normal flow.

create unique index evidence_items_analysis_url_key
  on public.evidence_items (analysis_id, lower(url));
