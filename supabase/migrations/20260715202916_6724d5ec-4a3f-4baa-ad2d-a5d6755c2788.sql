-- Deduplicate projections keeping most recent, then add unique constraint
DELETE FROM public.projections a
USING public.projections b
WHERE a.user_id = b.user_id
  AND a.category_id = b.category_id
  AND a.month = b.month
  AND (a.updated_at, a.created_at, a.id) < (b.updated_at, b.created_at, b.id);

ALTER TABLE public.projections
  ADD CONSTRAINT projections_user_category_month_key UNIQUE (user_id, category_id, month);