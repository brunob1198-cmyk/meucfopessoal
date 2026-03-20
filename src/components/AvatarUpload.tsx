import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AvatarUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const { data } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
    fetch(data.publicUrl, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      })
      .catch(() => {});
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const { error } = await supabase.storage.from('avatars').upload(`${user.id}/avatar`, file, {
      upsert: true,
      contentType: file.type,
    });

    if (error) {
      toast({ title: 'Erro ao enviar foto', description: error.message, variant: 'destructive' });
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      toast({ title: 'Foto de perfil atualizada!' });
    }
    setUploading(false);
  };

  return (
    <div className="relative group cursor-pointer inline-flex rounded-full" onClick={() => !uploading && fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      {avatarUrl ? (
        <img src={avatarUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-4 border-background shadow-md group-hover:opacity-80 transition-opacity" />
      ) : (
        <div className="h-24 w-24 rounded-full border-4 border-background shadow-md bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
          <User className="h-10 w-10 text-muted-foreground/60" />
        </div>
      )}
      <div className={`absolute inset-0 bg-black/50 rounded-full flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {uploading ? (
           <div className="h-6 w-6 border-2 border-white/80 border-t-white rounded-full animate-spin" />
        ) : (
          <Camera className="h-8 w-8 text-white/90" />
        )}
      </div>
    </div>
  );
}
