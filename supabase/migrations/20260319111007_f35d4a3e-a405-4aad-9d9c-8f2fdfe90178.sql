
ALTER TABLE public.connected_accounts 
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_bill_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pluggy_account_id text DEFAULT NULL;
