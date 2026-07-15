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

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    setTimeout(() => {
      if (scrollRef.current) setScrollPos(scrollRef.current.scrollLeft);
    }, 100);
  }

  function handleScroll() {
    if (scrollRef.current) setScrollPos(scrollRef.current.scrollLeft);
  }

  const el = scrollRef.current;
  const maxScroll = el ? el.scrollWidth - el.clientWidth : 0;
  const canScrollLeft = scrollPos > 4;
  const canScrollRight = scrollPos < maxScroll - 4;

  return (
    <div className={`relative w-full shrink-0 ${className}`}>
      <div
        ref={scrollRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-lg scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onScroll={handleScroll}
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
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
          <div className="mt-1 flex justify-center gap-1">
            {allMedia.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (!scrollRef.current) return;
                  const child = scrollRef.current.children[i] as HTMLElement;
                  if (child) child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
                }}
                className={`size-1.5 rounded-full transition-colors ${
                  Math.abs(scrollPos / (scrollRef.current?.clientWidth ?? 1) - i) < 0.3
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
