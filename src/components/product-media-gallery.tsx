import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

interface ProductMediaGalleryProps {
  imageUrl: string | null;
  videoUrl: string | null;
  media?: { url: string; type: "image" | "video" }[];
  className?: string;
}

export function ProductMediaGallery({ imageUrl, videoUrl, media, className = "" }: ProductMediaGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);

  const allMedia: { url: string; type: "image" | "video" }[] = [];

  if (videoUrl) allMedia.push({ url: videoUrl, type: "video" });
  if (imageUrl) allMedia.push({ url: imageUrl, type: "image" });
  if (media) allMedia.push(...media);

  if (allMedia.length === 0) return null;
  if (allMedia.length === 1) {
    const item = allMedia[0];
    return (
      <div className={`size-16 shrink-0 rounded-lg overflow-hidden ${className}`}>
        {item.type === "video" ? (
          <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
        ) : (
          <img src={item.url} alt="" className="size-full object-cover" />
        )}
      </div>
    );
  }

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 80;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    setScrollPos(scrollRef.current.scrollLeft + (dir === "left" ? -amount : amount));
  }

  const canScrollLeft = scrollPos > 0;
  const canScrollRight = scrollRef.current
    ? scrollPos < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 4
    : allMedia.length > 0;

  return (
    <div className="relative size-16 shrink-0">
      <div
        ref={scrollRef}
        className="flex size-full snap-x snap-mandatory overflow-x-auto scrollbar-hide rounded-lg"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onScroll={() => {
          if (scrollRef.current) setScrollPos(scrollRef.current.scrollLeft);
        }}
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
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow"
        >
          <ChevronLeft className="size-3" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow"
        >
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}
