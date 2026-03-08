import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ImagePlus } from 'lucide-react';

export function LogoUpload() {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const { data } = supabase.storage.from('logos').getPublicUrl(`${user.id}/logo`);
    fetch(data.publicUrl, { method: 'HEAD' }).then(res => {
      if (res.ok) setLogoUrl(data.publicUrl + '?t=' + Date.now());
    }).catch(() => {});
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const { error } = await supabase.storage.from('logos').upload(
      `${user.id}/logo`,
      file,
      { upsert: true, contentType: file.type }
    );

    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(`${user.id}/logo`);
      setLogoUrl(data.publicUrl + '?t=' + Date.now());
    }
  };

  return (
    <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-[160px] object-contain rounded" />
      ) : (
        <div className="h-10 w-10 rounded border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary/60 transition-colors">
          <ImagePlus className="h-5 w-5 text-muted-foreground/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity">
        <ImagePlus className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
