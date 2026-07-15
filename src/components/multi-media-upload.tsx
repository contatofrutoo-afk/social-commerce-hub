import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, Video, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const VIDEO_MAX_SIZE = 50 * 1024 * 1024;
const MAX_ITEMS = 4;

export interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface MultiMediaUploadProps {
  values: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  folder?: string;
  className?: string;
}

export function MultiMediaUpload({ values, onChange, folder = "general", className }: MultiMediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_ITEMS - values.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_ITEMS} mídias por produto.`);
      return;
    }

    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      const results: MediaItem[] = [];
      for (const file of toUpload) {
        const isVideo = VIDEO_TYPES.includes(file.type);
        if (!isVideo && !IMAGE_TYPES.includes(file.type)) {
          toast.error(`Formato não suportado: ${file.name}`);
          continue;
        }
        const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
        if (file.size > maxSize) {
          toast.error(`Arquivo muito grande: ${file.name} (máx ${isVideo ? "50MB" : "5MB"})`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("weaze-media").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("weaze-media").getPublicUrl(path);
        results.push({ url: urlData.publicUrl, type: isVideo ? "video" : "image" });
      }
      onChange([...values, ...results]);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao fazer upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {values.map((item, i) => (
          <div key={i} className="relative aspect-square rounded-lg border bg-muted/30 overflow-hidden group">
            {item.type === "video" ? (
              <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
            ) : (
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3" />
            </button>
            {item.type === "video" && (
              <div className="absolute bottom-1 left-1 rounded bg-background/80 p-0.5">
                <Video className="size-3" />
              </div>
            )}
          </div>
        ))}
        {values.length < MAX_ITEMS && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-2 text-[10px] text-muted-foreground hover:border-primary aspect-square">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span className="text-center leading-tight">
              {uploading ? "Enviando…" : `${MAX_ITEMS - values.length} restante${MAX_ITEMS - values.length > 1 ? "s" : ""}`}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              disabled={uploading}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
