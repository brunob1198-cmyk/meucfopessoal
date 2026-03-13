ALTER TABLE public.profiles
  ADD COLUMN gender text DEFAULT NULL,
  ADD COLUMN birth_date date DEFAULT NULL,
  ADD COLUMN profession text DEFAULT NULL;