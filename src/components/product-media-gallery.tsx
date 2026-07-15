import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

interface ProductMediaGalleryProps {
  imageUrl: string | null;
  videoUrl: string | null;
  media?: { url: string; type: "image" | "video" }[];
}

export function ProductMediaGallery({ imageUrl, videoUrl, media }: ProductMediaGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const allMedia: { url: string; type: "image" | "video" }[] = [];
  if (imageUrl) allMedia.push({ url: imageUrl, type: "image" });
  if (videoUrl) allMedia.push({ url: videoUrl, type: "video" });
  if (media) {
    for (const m of media) {
      if (!allMedia.some((a) => a.url === m.url)) {
        allMedia.push(m);
      }
    }
  }

  if (allMedia.length === 0) return null;

  function scroll(dir: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 80, behavior: "smooth" });
    setTimeout(updateArrows, 100);
  }

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  return (
    <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
      <div
        ref={scrollRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onScroll={updateArrows}
      >
        {allMedia.map((item, i) => (
          <div key={i} className="h-full w-20 shrink-0 snap-start">
            {item.type === "video" ? (
              <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
            ) : (
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
          </div>
        ))}
      </div>
      {allMedia.length > 1 && !atStart && (
        <button type="button" onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow-sm">
          <ChevronLeft className="size-3" />
        </button>
      )}
      {allMedia.length > 1 && !atEnd && (
        <button type="button" onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-0.5 shadow-sm">
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}
