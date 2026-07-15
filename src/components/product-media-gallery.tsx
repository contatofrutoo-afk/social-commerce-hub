import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";

interface ProductMediaGalleryProps {
  imageUrl: string | null;
  videoUrl: string | null;
  media?: { url: string; type: "image" | "video" }[];
}

export function ProductMediaGallery({ imageUrl, videoUrl, media }: ProductMediaGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const allMedia: { url: string; type: "image" | "video" }[] = [];
  if (videoUrl) allMedia.push({ url: videoUrl, type: "video" });
  if (imageUrl) allMedia.push({ url: imageUrl, type: "image" });
  if (media) allMedia.push(...media);

  const updateIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCurrentIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateIndex, { passive: true });
    return () => el.removeEventListener("scroll", updateIndex);
  }, [updateIndex]);

  function scrollTo(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: (index - currentIndex) * el.clientWidth, behavior: "smooth" });
    setCurrentIndex(index);
  }

  if (allMedia.length === 0) return null;

  return (
    <div className="relative w-20 h-20 shrink-0 overflow-hidden rounded-lg">
      <div
        ref={scrollRef}
        className="flex size-full snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {allMedia.map((item, i) => (
          <div key={i} className="size-full shrink-0 snap-start">
            {item.type === "video" ? (
              <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
            ) : (
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
          </div>
        ))}
      </div>
      {allMedia.length > 1 && currentIndex > 0 && (
        <button type="button" onClick={() => scrollTo(currentIndex - 1)} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow">
          <ChevronLeft className="size-3" />
        </button>
      )}
      {allMedia.length > 1 && currentIndex < allMedia.length - 1 && (
        <button type="button" onClick={() => scrollTo(currentIndex + 1)} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow">
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}
