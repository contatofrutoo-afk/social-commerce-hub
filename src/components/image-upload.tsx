import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, folder = "general", className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Formato não suportado. Use JPEG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_SIZE) {
      alert("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("weaze-media").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("weaze-media").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setPreview(publicUrl);
      onChange(publicUrl);
    } catch (err: any) {
      alert(err?.message ?? "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="" className="h-32 w-full rounded-lg object-cover sm:w-48" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-1 top-1 rounded-full bg-background/80 p-1 shadow"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground hover:border-primary">
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Upload className="size-6" />
          )}
          <span>{uploading ? "Enviando…" : "Clique para selecionar imagem"}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
