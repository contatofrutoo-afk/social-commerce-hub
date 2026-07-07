import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Sparkles,
  Users,
  ShoppingBag,
  QrCode,
  MessageSquareHeart,
  BarChart3,
  Check,
  ArrowRight,
  Star,
  Zap,
  ShieldCheck,
  Store,
} from "lucide-react";
import heroScene from "@/assets/hero-scene.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "WEAZE — Transforme visitas em relacionamento e vendas" },
      {
        name: "description",
        content:
          "Identifique quem entra no seu estabelecimento, crie um feed social do seu negócio e transforme cada visita em pedido, prova social e recorrência.",
      },
      { property: "og:title", content: "WEAZE — Social Commerce para negócios físicos" },
      {
        property: "og:description",
        content: "Check-in por QR, feed do estabelecimento, sacola direto do post e CRM automático.",
      },
    ],
  }),
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center">
            <Logo className="h-7" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#resultados" className="hover:text-foreground transition-colors">Resultados</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="shadow-elegant">
              <Link to="/auth">
                Começar grátis <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="weaze-hero-gradient relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" /> Social Commerce presencial
            </div>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Cada visita vira{" "}
              <span className="weaze-text-gradient">relacionamento</span>{" "}
              — e cada relacionamento vira venda.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A WEAZE transforma o seu estabelecimento em um pequeno Instagram próprio:
              seus clientes fazem check-in, curtem, comentam e pedem sem sair da mesa.
              Você recebe pedidos, prova social e inteligência de comportamento em tempo real.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <Link to="/auth">
                  Ativar meu estabelecimento <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary" /> Sem ERP
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary" /> Sem PDV
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary" /> Ativo em 5 minutos
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-glow">
              <img
                src={heroScene}
                alt="Cliente fazendo check-in em restaurante com QR code"
                width={1600}
                height={1200}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border/60 bg-card p-4 shadow-elegant sm:block">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Clientes presentes agora</div>
                  <div className="font-display text-xl font-bold">+42 pessoas</div>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 top-8 hidden rounded-2xl border border-border/60 bg-card p-4 shadow-elegant md:block">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pedido pelo feed</div>
                  <div className="font-display text-xl font-bold">+R$ 87,00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF STRIP */}
      <section className="border-y border-border/60 bg-muted/40 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Usado por bares, restaurantes, cafés, salões e lojas físicas em todo o Brasil
          </p>
          <div className="mt-6 grid grid-cols-2 gap-8 text-center sm:grid-cols-4">
            {[
              { v: "+3.2×", l: "recorrência" },
              { v: "68%", l: "clientes identificados" },
              { v: "R$ 41", l: "ticket médio incremental" },
              { v: "15s", l: "para o check-in" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-3xl font-extrabold weaze-text-gradient">{s.v}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Você conhece <span className="weaze-text-gradient">quem entra</span> no seu negócio?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          O e-commerce sabe tudo sobre cada cliente. O negócio físico, quase nada.
          Rostos anônimos entram, consomem e vão embora — sem nome, sem histórico, sem retorno.
          A WEAZE muda isso sem instalar nada, sem trocar seu PDV e sem burocracia.
        </p>
      </section>

      {/* FEATURES */}
      <section id="recursos" className="border-y border-border/60 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Plataforma completa
            </div>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Tudo que o físico precisa para virar digital.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Um ecossistema de identificação, conteúdo, venda e inteligência — desenhado para o balcão, não para a nuvem.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: QrCode,
                title: "Check-in em 15 segundos",
                desc: "QR code na mesa, no balcão ou na porta. Nome + WhatsApp + contexto da visita. Sem app, sem cadastro longo.",
              },
              {
                icon: Sparkles,
                title: "Feed social do seu negócio",
                desc: "Publicações do estabelecimento e dos clientes. Fotos, vídeos, produtos marcados e comentários — como um Instagram interno.",
              },
              {
                icon: ShoppingBag,
                title: "Sacola dentro do feed",
                desc: "Cada publicação vira vitrine. O cliente adiciona à sacola sem sair da experiência e o pedido chega em tempo real.",
              },
              {
                icon: MessageSquareHeart,
                title: "CRM automático",
                desc: "Histórico de visitas, preferências, contexto (casal, amigos, família) e engajamento — construído clique a clique.",
              },
              {
                icon: BarChart3,
                title: "Dashboard inteligente",
                desc: "Recorrência, ticket, produtos mais amados, horários de pico e insights acionáveis que aparecem sozinhos.",
              },
              {
                icon: Store,
                title: "Feito para o balcão",
                desc: "Zero integração com ERP, PDV ou logística. É a WEAZE, do primeiro check-in ao insight de recompra.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border/60 bg-card p-6 shadow-elegant transition hover:-translate-y-1 hover:border-primary/40"
              >
                <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="size-6" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Em 3 passos, seu negócio fica <span className="weaze-text-gradient">vivo digitalmente</span>.
          </h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Ative seu QR",
              desc: "Cadastre seu estabelecimento em minutos, gere QRs para mesas e balcão e comece a receber check-ins.",
            },
            {
              n: "02",
              title: "Publique no feed",
              desc: "Compartilhe pratos, promoções, momentos. Marque produtos e transforme cada post em uma vitrine.",
            },
            {
              n: "03",
              title: "Venda e fidelize",
              desc: "Receba pedidos, converse com clientes, entenda o comportamento e traga todo mundo de volta.",
            },
          ].map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-border/60 bg-card p-8 shadow-elegant">
              <div className="font-display text-6xl font-extrabold weaze-text-gradient">{s.n}</div>
              <h3 className="mt-4 font-display text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RESULTS / TESTIMONIALS */}
      <section id="resultados" className="border-y border-border/60 bg-gradient-to-b from-muted/30 to-background py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Negócios reais, resultados reais.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Rafa — Bar do Chef",
                text: "Em 30 dias identificamos 1.400 clientes que antes eram anônimos. O feed virou o motor da recompra.",
                stat: "+38% ticket médio",
              },
              {
                name: "Camila — Café Aurora",
                text: "Os clientes publicam por conta própria e viraliza dentro do próprio café. Nunca vi engajamento assim.",
                stat: "+2.9× visitas/mês",
              },
              {
                name: "Diego — Hamburgueria Norte",
                text: "Sabemos exatamente qual combo mais vende, em qual horário, para qual perfil. Dinheiro na mesa.",
                stat: "+R$ 22 mil/mês",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/60 bg-card p-6 shadow-elegant">
                <div className="flex text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-base leading-relaxed">"{t.text}"</p>
                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs font-bold weaze-text-gradient">{t.stat}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section id="planos" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Comece hoje. <span className="weaze-text-gradient">Cresça amanhã.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem taxa de setup. Sem contrato longo. Cancele quando quiser.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl rounded-3xl border-2 border-primary/30 bg-card p-8 shadow-glow sm:p-12">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                <Zap className="size-3.5" /> Acesso completo
              </div>
              <h3 className="mt-4 font-display text-4xl font-extrabold">WEAZE Pro</h3>
              <p className="mt-2 text-muted-foreground">
                Tudo que você precisa para transformar visitas em relacionamento e vendas.
              </p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-6xl font-extrabold weaze-text-gradient">R$ 149</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <Button asChild size="lg" className="mt-6 w-full shadow-glow sm:w-auto">
                <Link to="/auth">
                  Ativar meu estabelecimento <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
            <ul className="space-y-3">
              {[
                "Check-in ilimitado por QR code",
                "Feed social com fotos, vídeos e produtos",
                "Sacola integrada e pedidos em tempo real",
                "CRM completo de clientes e visitas",
                "Dashboard com insights automáticos",
                "Suporte humano por WhatsApp",
              ].map((it) => (
                <li key={it} className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3" />
                  </div>
                  <span className="text-sm">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="weaze-gradient rounded-3xl px-6 py-20 shadow-glow sm:px-16">
            <ShieldCheck className="mx-auto size-10 text-primary-foreground/90" />
            <h2 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl">
              Pare de perder clientes que já entraram.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
              Ative a WEAZE hoje e veja, ainda essa semana, quem entra, o que amam e o que compram no seu negócio.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 shadow-elegant">
              <Link to="/auth">
                Começar agora — grátis <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <Logo className="h-6" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} WEAZE. Social commerce para negócios físicos.
          </p>
        </div>
      </footer>
    </div>
  );
}
