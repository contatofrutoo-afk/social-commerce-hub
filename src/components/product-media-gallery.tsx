import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ProductMediaGalleryProps {
  imageUrl: string | null;
  videoUrl: string | null;
  media?: { url: string; type: "image" | "video" }[];
  size?: number;
}

export function ProductMediaGallery({ imageUrl, videoUrl, media, size = 80 }: ProductMediaGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

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

  useEffect(() => {
    updateArrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMedia.length]);

  if (allMedia.length === 0) return null;

  function scroll(dir: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * size, behavior: "smooth" });
    setTimeout(updateArrows, 150);
  }

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    setActiveIdx(Math.round(el.scrollLeft / size));
  }

  const arrowSize = size >= 112 ? "size-4" : "size-3";
  const showControls = allMedia.length > 1;

  return (
    <div className="relative shrink-0 overflow-hidden rounded-lg bg-muted" style={{ width: size, height: size }}>
      <div
        ref={scrollRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onScroll={updateArrows}
      >
        {allMedia.map((item, i) => (
          <div key={i} className="h-full shrink-0 snap-start" style={{ width: size }}>
            {item.type === "video" ? (
              <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
            ) : (
              <img src={item.url} alt="" className="size-full object-cover" loading="lazy" />
            )}
          </div>
        ))}
      </div>
      {showControls && !atStart && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Imagem anterior"
          className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/90 p-1 shadow-md hover:bg-background sm:block"
        >
          <ChevronLeft className={arrowSize} />
        </button>
      )}
      {showControls && !atEnd && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Próxima imagem"
          className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/90 p-1 shadow-md hover:bg-background sm:block"
        >
          <ChevronRight className={arrowSize} />
        </button>
      )}
      {showControls && size >= 112 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center gap-1">
          {allMedia.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIdx ? "w-4 bg-white" : "w-1.5 bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
      {showControls && size < 112 && (
        <div className="pointer-events-none absolute right-1 top-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] font-medium">
          {activeIdx + 1}/{allMedia.length}
        </div>
      )}
    </div>
  );
}
