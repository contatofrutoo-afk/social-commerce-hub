import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { productRepository } from "@/repositories/product.repository";
import { getSession } from "@/lib/session";

interface ProductMediaGalleryProps {
  imageUrl: string | null;
  videoUrl: string | null;
  media?: { url: string; type: "image" | "video" }[];
  size?: number;
  /** Se informado, registra evento `view` quando o cliente amplia a mídia. */
  productId?: string;
  companyId?: string;
}

export function ProductMediaGallery({ imageUrl, videoUrl, media, size = 80, productId, companyId }: ProductMediaGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

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

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const nextLightbox = useCallback(
    () => setLightboxIdx((i) => (i === null ? i : (i + 1) % allMedia.length)),
    [allMedia.length],
  );
  const prevLightbox = useCallback(
    () => setLightboxIdx((i) => (i === null ? i : (i - 1 + allMedia.length) % allMedia.length)),
    [allMedia.length],
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") nextLightbox();
      else if (e.key === "ArrowLeft") prevLightbox();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIdx, closeLightbox, nextLightbox, prevLightbox]);

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

  // Touch swipe support in lightbox
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) nextLightbox();
      else prevLightbox();
    }
    touchStartX.current = null;
  }

  return (
    <>
      <div className="relative shrink-0 overflow-hidden rounded-lg bg-muted" style={{ width: size, height: size }}>
        <div
          ref={scrollRef}
          className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={updateArrows}
        >
          {allMedia.map((item, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                setLightboxIdx(i);
                // Métricas: cliente ampliou uma mídia do produto → view.
                if (productId && companyId) {
                  const session = getSession();
                  const customerId =
                    session?.companyId === companyId ? session.customerId : undefined;
                  productRepository
                    .recordEvent(productId, companyId, "view", customerId)
                    .catch(() => {});
                  productRepository.incrementCounter(productId, "views_count").catch(() => {});
                }
              }}
              aria-label="Ampliar mídia"
              className="h-full shrink-0 snap-start cursor-zoom-in"
              style={{ width: size }}
            >
              {item.type === "video" ? (
                <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
              ) : (
                <img src={item.url} alt="" className="size-full object-cover" loading="lazy" />
              )}
            </button>
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

      {lightboxIdx !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-fade-in"
            onClick={closeLightbox}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button
              type="button"
              onClick={closeLightbox}
              aria-label="Fechar"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
            {allMedia.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevLightbox();
                  }}
                  aria-label="Anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6 sm:p-3"
                >
                  <ChevronLeft className="size-6 sm:size-8" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextLightbox();
                  }}
                  aria-label="Próximo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6 sm:p-3"
                >
                  <ChevronRight className="size-6 sm:size-8" />
                </button>
              </>
            )}
            <div
              className="flex max-h-[90vh] max-w-[95vw] items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {allMedia[lightboxIdx].type === "video" ? (
                <video
                  key={allMedia[lightboxIdx].url}
                  src={allMedia[lightboxIdx].url}
                  className="max-h-[90vh] max-w-[95vw] object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={allMedia[lightboxIdx].url}
                  alt=""
                  className="max-h-[90vh] max-w-[95vw] object-contain"
                />
              )}
            </div>
            {allMedia.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                {lightboxIdx + 1} / {allMedia.length}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
