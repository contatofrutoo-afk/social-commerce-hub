import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, ShoppingBag, Utensils } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
              W
            </div>
            <span className="text-lg font-semibold tracking-tight">WEAZE</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/c/$companySlug" params={{ companySlug: "demo" }}>
                Ver demo
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm text-accent-foreground">
          <Sparkles className="size-4" /> Social Commerce para negócios físicos
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
          Conheça <span className="text-primary">quem entra</span>
          <br />
          no seu estabelecimento.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Identifique clientes, registre comportamento, gere prova social e transforme visitas
          em relacionamento — sem ERP, sem PDV, sem complexidade.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/c/$companySlug" params={{ companySlug: "demo" }}>
              Experimentar como cliente
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Acessar dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {[
          { icon: Users, title: "Identifique", desc: "Check-in em 15 segundos por QR." },
          { icon: Sparkles, title: "Engaje", desc: "Feed social do seu estabelecimento." },
          { icon: ShoppingBag, title: "Venda", desc: "Sacola direto do feed, pedido em tempo real." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6">
            <f.icon className="size-6 text-primary" />
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <Utensils className="mx-auto mb-2 size-4" />
        WEAZE — MVP
      </footer>
    </div>
  );
}
