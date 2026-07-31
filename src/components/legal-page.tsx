import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, ListTree, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LEGAL_UPDATED_AT, LEGAL_VERSION, type LegalSection } from "@/lib/legal";
import { cn } from "@/lib/utils";

export function LegalPage({
  eyebrow,
  title,
  intro,
  icon: Icon,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: LegalSection[];
}) {
  const [active, setActive] = useState(sections[0]?.id);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  function goTo(id: string) {
    setTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen scroll-smooth bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="shrink-0">
            <Logo className="h-14 sm:h-16" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setTocOpen((v) => !v)}
              aria-label="Índice"
            >
              {tocOpen ? <X className="size-4" /> : <ListTree className="size-4" />}
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/">
                <ArrowLeft className="mr-1.5 size-4" /> Voltar
              </Link>
            </Button>
          </div>
        </div>
        {tocOpen && (
          <nav className="border-t border-border/60 bg-background p-4 lg:hidden">
            <ul className="space-y-1 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => goTo(s.id)}
                    className="w-full rounded-lg px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Icon className="size-3.5" /> {eyebrow}
          </div>
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{intro}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-xs text-muted-foreground shadow-sm">
            <CalendarClock className="size-3.5 text-primary" />
            Última atualização: <span className="font-semibold text-foreground">{LEGAL_UPDATED_AT}</span>
            <span className="text-border">•</span> versão {LEGAL_VERSION}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-28">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Navegação
            </p>
            <ul className="space-y-0.5 border-l border-border/60">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => goTo(s.id)}
                    className={cn(
                      "-ml-px block w-full border-l-2 px-3 py-1.5 text-left text-sm transition-colors",
                      active === s.id
                        ? "border-primary font-semibold text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="max-w-3xl space-y-12">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="font-display text-2xl font-bold tracking-tight">{s.title}</h2>
              <div className="mt-4 space-y-4">
                {s.blocks.map((b, i) =>
                  typeof b === "string" ? (
                    <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">
                      {b}
                    </p>
                  ) : (
                    <div key={i} className="rounded-2xl border border-border/60 bg-card p-5">
                      <p className="text-sm font-semibold">{b.subtitle}</p>
                      <ul className="mt-3 space-y-2">
                        {b.items.map((it, j) => (
                          <li key={j} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}

          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
            Documento produzido especificamente para a weaze e para as funcionalidades hoje
            disponíveis na plataforma. Dúvidas? Escreva para{" "}
            <a href="mailto:privacidade@weaze.com.br" className="font-semibold text-primary hover:underline">
              privacidade@weaze.com.br
            </a>
            .
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="secondary">
              <Link to="/termos">Termos de Uso</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/privacy">Política de Privacidade</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">
                <ArrowLeft className="mr-1.5 size-4" /> Voltar ao início
              </Link>
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}
