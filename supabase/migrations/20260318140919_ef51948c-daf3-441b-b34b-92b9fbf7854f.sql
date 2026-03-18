
CREATE TABLE public.economic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.economic_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON public.economic_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.economic_radar_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_radar_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.economic_radar_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON public.economic_radar_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
