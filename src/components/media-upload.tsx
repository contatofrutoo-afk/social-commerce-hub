import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export type MediaKind = "image" | "video";

interface MediaUploadProps {
  imageUrl: string | null;
  videoUrl: string | null;
  onChange: (val: { imageUrl: string | null; videoUrl: string | null }) => void;
  folder?: string;
  className?: string;
}

export function MediaUpload({ imageUrl, videoUrl, onChange, folder = "general", className }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<MediaKind>(videoUrl ? "video" : "image");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (videoUrl) setKind("video");
    else if (imageUrl) setKind("image");
  }, [imageUrl, videoUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      toast.error("Formato não suportado. Imagens (JPG, PNG, WebP, GIF) ou vídeos (MP4, WebM, MOV).");
      return;
    }
    const max = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > max) {
      toast.error(`Arquivo muito grande. Máximo ${isVideo ? "50MB" : "5MB"}.`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("weaze-media").upload(path, file, {
        contentType: file.type,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("weaze-media").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      if (isVideo) {
        onChange({ imageUrl: null, videoUrl: publicUrl });
        setKind("video");
      } else {
        onChange({ imageUrl: publicUrl, videoUrl: null });
        setKind("image");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange({ imageUrl: null, videoUrl: null });
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasMedia = Boolean(imageUrl || videoUrl);

  return (
    <div className={cn("space-y-2", className)}>
      {hasMedia ? (
        <div className="relative inline-block w-full">
          {videoUrl ? (
            <video
              src={videoUrl}
              className="max-h-72 w-full rounded-lg bg-black object-contain"
              controls
              playsInline
            />
          ) : (
            <img src={imageUrl!} alt="" className="max-h-72 w-full rounded-lg object-cover" />
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow"
            aria-label="Remover mídia"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground hover:border-primary">
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <ImageIcon className="size-6" />
              <span className="text-xs">ou</span>
              <VideoIcon className="size-6" />
            </div>
          )}
          <span className="font-medium">
            {uploading ? "Enviando…" : "Clique para adicionar imagem ou vídeo"}
          </span>
          <span className="text-xs">Imagem até 5MB · Vídeo até 50MB</span>
          <input
            ref={inputRef}
            type="file"
            accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}
      {/* kind is tracked to keep UX consistent when swapping media */}
      <span className="sr-only">{kind}</span>
    </div>
  );
}
