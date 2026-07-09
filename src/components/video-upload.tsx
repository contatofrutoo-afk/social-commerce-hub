import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ALLOWED_TYPES = ["video/mp4", "video/webm"];
const MAX_SIZE = 50 * 1024 * 1024;

interface VideoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
}

export function VideoUpload({ value, onChange, folder = "general", className }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(value);
  }, [value]);

  async function validateVideo(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);

        const { videoWidth, videoHeight, duration } = video;

        const ratio = videoWidth / videoHeight;
        const expectedRatio = 9 / 16;
        const ratioTolerance = 0.05;

        if (Math.abs(ratio - expectedRatio) > ratioTolerance) {
          toast.error(`Proporção inválida: ${videoWidth}×${videoHeight}. Use 9:16 (1080×1920).`);
          resolve(false);
          return;
        }

        if (duration > 180) {
          toast.error(`Vídeo muito longo: ${Math.round(duration)}s. Máximo 180 segundos.`);
          resolve(false);
          return;
        }

        resolve(true);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        toast.error("Não foi possível ler o arquivo de vídeo.");
        resolve(false);
      };

      video.src = URL.createObjectURL(file);
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado. Use MP4 ou WebM.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    const valid = await validateVideo(file);
    if (!valid) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("weaze-media").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("weaze-media").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setPreview(publicUrl);
      onChange(publicUrl);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao fazer upload");
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
          <video
            src={preview}
            className="h-64 w-full rounded-lg object-cover sm:w-48"
            controls
            playsInline
          />
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
            <Video className="size-6" />
          )}
          <span>{uploading ? "Enviando…" : "Clique para selecionar vídeo"}</span>
          <span className="text-[10px] text-muted-foreground/60">MP4 ou WebM · 9:16 (1080×1920) · até 50MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
