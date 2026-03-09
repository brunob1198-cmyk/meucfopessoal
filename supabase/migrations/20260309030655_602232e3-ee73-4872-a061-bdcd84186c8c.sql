ALTER TABLE public.transactions ADD COLUMN payment_date date;

-- Set existing transactions: payment_date = date for non-installment, date for installments (each installment already has its own date)
UPDATE public.transactions SET payment_date = date WHERE payment_date IS NULL;

-- Set default for future inserts
ALTER TABLE public.transactions ALTER COLUMN payment_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.transactions ALTER COLUMN payment_date SET NOT NULL;