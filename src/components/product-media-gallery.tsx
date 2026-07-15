import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";

interface ProductMediaGalleryProps {
  imageUrl: string | null;
  videoUrl: string | null;
  media?: { url: string; type: "image" | "video" }[];
}

export function ProductMediaGallery({ imageUrl, videoUrl, media }: ProductMediaGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const allMedia: { url: string; type: "image" | "video" }[] = [];
  if (videoUrl) allMedia.push({ url: videoUrl, type: "video" });
  if (imageUrl) allMedia.push({ url: imageUrl, type: "image" });
  if (media) allMedia.push(...media);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    return () => el.removeEventListener("scroll", updateButtons);
  }, [updateButtons]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" });
  }

  if (allMedia.length === 0) return null;

  return (
    <div className="relative w-20 h-20 shrink-0">
      <div
        ref={scrollRef}
        className="flex size-full snap-x snap-mandatory overflow-x-auto rounded-lg"
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
      {allMedia.length > 1 && canScrollLeft && (
        <button type="button" onClick={() => scroll("left")} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow">
          <ChevronLeft className="size-3" />
        </button>
      )}
      {allMedia.length > 1 && canScrollRight && (
        <button type="button" onClick={() => scroll("right")} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow">
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}
