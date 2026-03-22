-- Insert the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for avatars
CREATE POLICY "Avatar images are publicly accessible." 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar." 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar." 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar." 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Insert the logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for logos
CREATE POLICY "Logo images are publicly accessible." 
ON storage.objects FOR SELECT 
USING (bucket_id = 'logos');

CREATE POLICY "Users can upload their own logo." 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'logos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own logo." 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK (
    bucket_id = 'logos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own logo." 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'logos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);
