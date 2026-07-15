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

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, [updateScrollButtons]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (allMedia.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-lg"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {allMedia.map((item, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {item.type === "video" ? (
              <video
                src={item.url}
                className="w-full aspect-square object-cover"
                preload="metadata"
                muted
                playsInline
              />
            ) : (
              <img src={item.url} alt="" className="w-full aspect-square object-cover" />
            )}
          </div>
        ))}
      </div>
      {allMedia.length > 1 && (
        <>
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow hover:bg-background"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow hover:bg-background"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
