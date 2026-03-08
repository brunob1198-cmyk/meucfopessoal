
-- Drop existing FK and recreate with CASCADE
ALTER TABLE public.transactions DROP CONSTRAINT transactions_category_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Also cascade projections when category is deleted
ALTER TABLE public.projections DROP CONSTRAINT projections_category_id_fkey;
ALTER TABLE public.projections ADD CONSTRAINT projections_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;
