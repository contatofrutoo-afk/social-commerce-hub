import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Check,
  QrCode,
  Sparkles,
  Users,
  ShoppingBag,
  BarChart3,
  MessageSquareHeart,
  Layers,
  Store,
  Utensils,
  Coffee,
  Scissors,
  Dumbbell,
  Heart,
  Wine,
  Instagram,
  Linkedin,
  TrendingUp,
  Zap,
  Bell,
  Package,
} from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import sceneCafe from "@/assets/scene-cafe.jpg";
import sceneRestaurant from "@/assets/scene-restaurant.jpg";
import sceneShop from "@/assets/scene-shop.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "weaze — Autoatendimento Inteligente para Negócios Locais" },
      {
        name: "description",
        content:
          "Seus clientes descobrem produtos, pedem, personalizam e pagam pelo celular. Sua empresa recebe dados, métricas e inteligência para vender mais.",
      },
      { property: "og:title", content: "weaze — Autoatendimento Inteligente para Negócios Locais" },
      {
        property: "og:description",
        content: "Autoatendimento por QR Code: catálogo, pedidos, pagamento pelo celular e inteligência em tempo real para o seu negócio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },

    ],
  }),
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Features />
      <Benefits />
      <ForWho />
      <DashboardShowcase />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ============================== NAV ============================== */
function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-28 sm:h-36 md:h-40" />
        </Link>
        <nav className="hidden items-center gap-9 text-sm font-medium text-muted-foreground md:flex">
          <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
          <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
          <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-5 shadow-elegant">
            <Link to="/auth">
              Começar agora <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ============================== HERO ============================== */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft gradient background */}
      <div className="absolute inset-0 -z-10 weaze-hero-gradient" />
      <div className="absolute -top-32 left-1/2 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-32 lg:pt-28">
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
            Autoatendimento Inteligente para Negócios Locais
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-display mt-6 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            Transforme seu negócio em um{" "}
            <span className="weaze-text-gradient">autoatendimento inteligente.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Com a weaze, seus clientes descobrem produtos, fazem pedidos, personalizam a
            compra, pagam pelo celular e retiram tudo de forma simples, rápida e sem filas.
            Enquanto isso, sua empresa recebe dados, métricas e inteligência para vender
            cada vez mais.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7 text-base shadow-glow">
              <Link to="/auth">
                Começar agora <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7 text-base">
              <a href="#como-funciona">Agendar demonstração</a>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Check className="size-4 text-primary" /> Sem instalação</div>
            <div className="flex items-center gap-2"><Check className="size-4 text-primary" /> Sem fidelidade</div>
            <div className="flex items-center gap-2"><Check className="size-4 text-primary" /> Ativo em poucos minutos</div>
          </motion.div>

        </motion.div>

        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-tr from-primary/25 via-primary/5 to-transparent blur-3xl" />
        <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-glow">
          <img
            src={heroDashboard}
            alt="Dashboard da weaze mostrando feed social, métricas e QR code"
            width={1024}
            height={1024}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Floating card 1 */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-6 top-16 hidden rounded-2xl border border-border/60 bg-background/90 p-4 shadow-elegant backdrop-blur-xl sm:flex sm:items-center sm:gap-3"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Check-ins hoje</div>
            <div className="font-display text-xl font-semibold">+128</div>
          </div>
        </motion.div>

        {/* Floating card 2 */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute -right-4 bottom-20 hidden rounded-2xl border border-border/60 bg-background/90 p-4 shadow-elegant backdrop-blur-xl sm:flex sm:items-center sm:gap-3"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pedido pelo feed</div>
            <div className="font-display text-xl font-semibold">R$ 87,00</div>
          </div>
        </motion.div>

        {/* Floating card 3 */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -right-6 -top-4 hidden rounded-2xl border border-border/60 bg-background/90 p-3 shadow-elegant backdrop-blur-xl md:flex md:items-center md:gap-2"
        >
          <TrendingUp className="size-4 text-emerald-500" />
          <span className="text-xs font-semibold">+38% ticket</span>
        </motion.div>
      </motion.div>
    </div>
  );
}


/* ============================== PROBLEM (dark, warning) ============================== */
function Problem() {
  const bullets = [
    "Clientes aguardando atendimento.",
    "Filas desnecessárias.",
    "Pedidos manuais.",
    "Baixa produtividade.",
    "Pouco conhecimento sobre o comportamento do cliente.",
  ];
  return (
    <section className="relative overflow-hidden bg-[#0b0b12] py-28 text-white sm:py-36">
      <div className="absolute inset-0 -z-10 opacity-40" style={{ backgroundImage: "radial-gradient(600px 400px at 15% 20%, rgba(239,68,68,0.25), transparent 60%), radial-gradient(500px 300px at 90% 80%, rgba(168,85,247,0.2), transparent 60%)" }} />
      <div className="absolute inset-0 -z-10 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-300">
              <span className="size-1.5 rounded-full bg-red-400 animate-pulse" /> O problema
            </div>
            <h2 className="font-display mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Seu negócio ainda depende de atendimento para{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-300 bg-clip-text text-transparent">vender?</span>
            </h2>
            <p className="mt-6 text-lg text-white/60">Filas, espera, pedidos anotados manualmente, clientes desistindo e falta de informações sobre quem compra fazem parte da rotina de milhares de negócios locais. Enquanto isso, o consumidor já espera resolver tudo pelo próprio celular.</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {bullets.map((b, i) => (
                <li key={b} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
                  <span className="font-display text-sm font-semibold text-red-400/80">0{i + 1}</span>
                  <span className="text-sm text-white/85">{b}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
          <FadeIn>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-red-500/20 via-transparent to-transparent blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                <img src={sceneCafe} alt="Cliente escaneando QR code em um café" width={1024} height={1024} loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50">Sem weaze</div>
                    <div className="font-display text-2xl font-semibold">Fila e pedido manual</div>
                  </div>
                  <div className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 backdrop-blur">Atendimento lento</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ============================== SOLUTION (giant statement) ============================== */
function Solution() {
  return (
    <section className="relative overflow-hidden py-32 sm:py-40">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-primary/5 to-background" />
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute left-1/2 top-1/2 -z-10 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
        style={{ background: "conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.4), transparent, hsl(var(--primary) / 0.3), transparent)" }}
      />
      <div className="mx-auto max-w-5xl px-6 text-center">
        <FadeIn>
          <Eyebrow>A solução</Eyebrow>
          <h2 className="font-display mt-6 text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl">
            A <span className="weaze-text-gradient italic">weaze</span> automatiza toda a experiência de compra.
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-muted-foreground">
            Seu cliente acessa o catálogo pelo QR Code, escolhe produtos, personaliza o pedido, paga diretamente pelo celular e acompanha todo o processo. Enquanto isso, a weaze registra automaticamente cada interação e{" "}
            <span className="text-foreground font-medium">transforma tudo em inteligência para o seu negócio.</span>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ============================== HOW IT WORKS (timeline) ============================== */
function HowItWorks() {
  const steps = [
    { n: "01", icon: QrCode, title: "Cliente acessa pelo QR Code", desc: "Sem baixar aplicativo. Sem cadastro obrigatório." },
    { n: "02", icon: Heart, title: "Explora o catálogo", desc: "Descobre produtos, visualiza promoções, interage e monta seu pedido." },
    { n: "03", icon: Sparkles, title: "Finaliza a compra", desc: "Paga diretamente pelo Mercado Pago ou pelo estabelecimento e recebe confirmação automática." },
    { n: "04", icon: BarChart3, title: "Retira ou recebe seu pedido", desc: "A empresa acompanha tudo em tempo real pelo Dashboard." },
  ];
  return (
    <Section id="como-funciona" className="bg-muted/30 border-y border-border/60">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow>Como funciona</Eyebrow>
        <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Simples para o cliente. <br className="hidden sm:block" />
          <span className="weaze-text-gradient">Automático para o seu negócio.</span>
        </h2>
      </FadeIn>
      <div className="relative mt-20">
        <div aria-hidden className="absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent lg:block" />
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="space-y-6">
          {steps.map((s, i) => (
            <motion.div key={s.n} variants={fadeUp} className="relative grid gap-6 lg:grid-cols-[80px_1fr] lg:items-start">
              <div className="relative z-10 flex lg:justify-center">
                <div className="grid size-16 place-items-center rounded-2xl border border-primary/30 bg-background shadow-elegant">
                  <s.icon className="size-6 text-primary" />
                </div>
              </div>
              <div className={`group rounded-3xl border border-border/60 bg-card p-8 transition hover:border-primary/40 hover:shadow-elegant ${i % 2 === 1 ? "lg:ml-12" : ""}`}>
                <div className="flex items-center gap-4">
                  <span className="font-display text-5xl font-semibold text-primary/20">{s.n}</span>
                  <h3 className="font-display text-2xl font-semibold">{s.title}</h3>
                </div>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ============================== FEATURES (bento) ============================== */
function Features() {
  return (
    <section id="recursos" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <Eyebrow>Recursos</Eyebrow>
          <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Tudo para vender no autoatendimento em uma{" "}
            <span className="weaze-text-gradient">única plataforma.</span>
          </h2>
        </FadeIn>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid gap-4 md:grid-cols-6 md:auto-rows-[minmax(180px,auto)]"
        >
          {/* Big hero card */}
          <motion.div variants={fadeUp} className="group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:col-span-4 md:row-span-2">
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/20 blur-3xl transition group-hover:bg-primary/30" />
            <div className="relative">
              <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
                <Sparkles className="size-6" />
              </div>
              <h3 className="font-display mt-6 text-3xl font-semibold">Feed Social</h3>
              <p className="mt-3 max-w-md text-base text-muted-foreground">Transforme seu catálogo em uma experiência interativa.</p>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <MessageSquareHeart className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">CRM Inteligente</h3>
            <p className="mt-2 text-sm text-muted-foreground">Conheça automaticamente o comportamento dos seus clientes.</p>
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <Users className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">Atendimento Inteligente</h3>
            <p className="mt-2 text-sm text-muted-foreground">Saiba exatamente quem está presente e como oferecer uma experiência melhor.</p>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <Layers className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">Catálogo Inteligente</h3>
            <p className="mt-2 text-sm text-muted-foreground">Produtos inteligentes com QR Codes individuais.</p>
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <ShoppingBag className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">Pedidos</h3>
            <p className="mt-2 text-sm text-muted-foreground">Pedidos digitais sem complicação.</p>
          </motion.div>
          <motion.div variants={fadeUp} className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary p-6 text-primary-foreground md:col-span-2">
            <BarChart3 className="size-6" />
            <h3 className="font-display mt-4 text-lg font-semibold">Dashboard</h3>
            <p className="mt-2 text-sm text-primary-foreground/80">Acompanhe toda a operação em tempo real.</p>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <QrCode className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">QR Codes</h3>
            <p className="mt-2 text-sm text-muted-foreground">QR para mesas, para loja e para produtos. Tudo integrado.</p>
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <Package className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">Pagamentos</h3>
            <p className="mt-2 text-sm text-muted-foreground">Receba pagamentos diretamente pelo Mercado Pago.</p>
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-3xl border border-border/60 bg-card p-6 md:col-span-2">
            <Store className="size-6 text-primary" />
            <h3 className="font-display mt-4 text-lg font-semibold">Perfil Inteligente</h3>
            <p className="mt-2 text-sm text-muted-foreground">Histórico completo de cada cliente, sem esforço.</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================== BENEFITS (dark stats) ============================== */
function Benefits() {
  const items = [
    { icon: TrendingUp, t: "Venda mais", n: "+ vendas", d: "Autoatendimento disponível o tempo todo." },
    { icon: Zap, t: "Atenda mais rápido", n: "- espera", d: "Reduza filas e agilize cada pedido." },
    { icon: ShoppingBag, t: "Automatize pedidos", n: "100%", d: "Pedidos digitais, sem anotação manual." },
    { icon: Bell, t: "Receba pagamentos digitais", n: "Pix e cartão", d: "Pagamento direto pelo celular do cliente." },
    { icon: Users, t: "Conheça seus clientes", n: "360°", d: "Comportamento registrado automaticamente." },
    { icon: BarChart3, t: "Decisões com dados", n: "Real-time", d: "Métricas ao vivo, sem achismo." },
  ];
  return (
    <section className="relative overflow-hidden bg-[#0a0a0f] py-28 text-white sm:py-36">
      <div className="absolute inset-0 -z-10 opacity-30" style={{ backgroundImage: "radial-gradient(700px 400px at 80% 10%, hsl(var(--primary) / 0.4), transparent 60%), radial-gradient(500px 300px at 10% 90%, hsl(var(--primary) / 0.25), transparent 60%)" }} />
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            Benefícios
          </div>
          <h2 className="font-display mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            Venda mais. Atenda mais rápido.{" "}
            <span className="bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">Reduza filas.</span>
          </h2>
        </FadeIn>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <motion.div key={it.t} variants={fadeUp} className="group relative bg-[#0a0a0f] p-8 transition hover:bg-white/[0.03]">
              <it.icon className="size-6 text-primary" />
              <div className="font-display mt-6 text-5xl font-semibold tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">{it.n}</div>
              <div className="mt-3 font-display text-lg font-medium">{it.t}</div>
              <div className="mt-1 text-sm text-white/50">{it.d}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================== FOR WHO (marquee) ============================== */
function ForWho() {
  const list = [
    { icon: Utensils, t: "Restaurantes" },
    { icon: Utensils, t: "Hamburguerias" },
    { icon: Utensils, t: "Pizzarias" },
    { icon: Utensils, t: "Sorveterias" },
    { icon: Utensils, t: "Açaí" },
    { icon: Coffee, t: "Cafeterias" },
    { icon: Store, t: "Lojas" },
    { icon: Wine, t: "Adegas" },
    { icon: Scissors, t: "Barbearias" },
    { icon: Scissors, t: "Salões" },
    { icon: Heart, t: "Clínicas" },
    { icon: Heart, t: "Pet Shops" },
    { icon: Dumbbell, t: "Academias" },
    { icon: Sparkles, t: "Qualquer negócio local" },
  ];
  const row = [...list, ...list];
  return (
    <Section>
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow>Para quem é</Eyebrow>
        <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Ideal para qualquer negócio local que queira vender mais através do{" "}
          <span className="weaze-text-gradient">autoatendimento.</span>
        </h2>
      </FadeIn>

      <div className="mt-14 space-y-4">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex w-max gap-4"
          >
            {row.map((it, i) => (
              <div key={i} className="flex shrink-0 items-center gap-3 rounded-full border border-border/60 bg-card px-5 py-3">
                <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <it.icon className="size-4" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{it.t}</span>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <motion.div
            animate={{ x: ["-50%", "0%"] }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            className="flex w-max gap-4"
          >
            {row.map((it, i) => (
              <div key={i} className="flex shrink-0 items-center gap-3 rounded-full border border-border/60 bg-card px-5 py-3">
                <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <it.icon className="size-4" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{it.t}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border/60 shadow-elegant">
          <img src={sceneRestaurant} alt="Grupo em restaurante usando weaze" width={1024} height={1024} loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="overflow-hidden rounded-3xl border border-border/60 shadow-elegant">
          <img src={sceneShop} alt="Loja usando weaze" width={1024} height={1024} loading="lazy" className="h-full w-full object-cover" />
        </div>
      </div>
    </Section>
  );
}

/* ============================== DASHBOARD SHOWCASE (split) ============================== */
function DashboardShowcase() {
  const stats = [
    { label: "Clientes", value: "3.482", icon: Users, delta: "+12%" },
    { label: "Check-ins", value: "1.209", icon: QrCode, delta: "+38%" },
    { label: "Pedidos", value: "R$ 41.9k", icon: ShoppingBag, delta: "+22%" },
    { label: "Recorrência", value: "3.2×", icon: TrendingUp, delta: "+8%" },
  ];
  return (
    <Section className="bg-muted/30 border-y border-border/60">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <FadeIn>
          <Eyebrow>Dashboard</Eyebrow>
          <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Controle toda sua operação{" "}
            <span className="weaze-text-gradient">em um único painel.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Acompanhe pedidos, pagamentos, clientes presentes, vendas, produtos, métricas e toda a operação do seu negócio em tempo real.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                animate={{ y: [0, i % 2 === 0 ? -6 : 6, 0] }}
                transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                className="rounded-2xl border border-border/60 bg-background p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <s.icon className="size-5 text-primary" />
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">{s.delta}</span>
                </div>
                <div className="mt-4 font-display text-2xl font-semibold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </FadeIn>
        <FadeIn>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-primary/25 via-primary/5 to-transparent blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-glow">
              <img src={heroDashboard} alt="weaze dashboard completo" width={1024} height={1024} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}




/* ============================== PRICING ============================== */
function Pricing() {
  const includes = [
    "Feed Social",
    "Catálogo Inteligente",
    "Pedidos digitais",
    "Pagamentos pelo Mercado Pago",
    "Dashboard em tempo real",
    "CRM Inteligente",
    "Atendimento Inteligente",
    "QR Codes ilimitados",
    "Clientes ilimitados",
    "Produtos ilimitados",
    "Atualizações contínuas",
    "Suporte",
  ];
  return (
    <Section id="planos">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow>Planos</Eyebrow>
        <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Tudo o que seu negócio precisa para{" "}
          <span className="weaze-text-gradient">vender de forma inteligente.</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">Sem taxas escondidas. Sem fidelidade.</p>
      </FadeIn>

      <FadeIn className="mx-auto mt-14 max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-8 shadow-glow sm:p-12">
          <div className="absolute -right-24 -top-24 -z-0 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Zap className="size-3.5" /> Acesso completo
              </div>
              <h3 className="font-display mt-4 text-4xl font-semibold">weaze PRO</h3>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-6xl font-semibold weaze-text-gradient">R$ 247</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <Button asChild size="lg" className="mt-8 w-full rounded-full text-base shadow-glow sm:w-auto">
                <Link to="/auth">
                  Começar agora <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <ul className="mt-6 space-y-1.5 text-sm text-muted-foreground">
                <li>Sem taxa de implantação.</li>
                <li>Sem fidelidade.</li>
                <li>Cancele quando quiser.</li>
              </ul>
            </div>
            <ul className="space-y-3">
              {includes.map((it) => (
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
      </FadeIn>
    </Section>
  );
}

/* ============================== FAQ ============================== */
function FAQ() {
  const faqs = [
    { q: "Preciso instalar aplicativo?", a: "Não. A weaze funciona 100% via QR Code e navegador. Nem você nem seus clientes precisam instalar nada." },
    { q: "Como meus clientes acessam?", a: "Basta escanear o QR Code do seu estabelecimento, mesa ou produto. Em segundos o cliente já está navegando pelo catálogo, sem cadastro obrigatório." },
    { q: "Como funciona o QR Code?", a: "Você gera QR Codes ilimitados no painel: um geral da loja, um por mesa e um por produto. Cada leitura já identifica o contexto da visita." },
    { q: "Como funciona o pagamento?", a: "O cliente paga diretamente pelo celular via Mercado Pago (Pix, cartão ou carteira) ou escolhe pagar no estabelecimento. A confirmação aparece automaticamente no painel." },
    { q: "Preciso de leitor de QR Code?", a: "Não. Quem escaneia é o próprio cliente, usando a câmera do celular. Você só precisa exibir o QR impresso ou na tela." },
    { q: "Posso usar sem Mercado Pago?", a: "Sim. Você pode operar apenas com pagamento no estabelecimento e ativar o pagamento online quando quiser." },
    { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, sem multa. Cancele em um clique quando quiser." },
  ];
  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <FadeIn className="lg:sticky lg:top-28">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Perguntas <span className="weaze-text-gradient">frequentes.</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">Tudo o que você precisa saber antes de começar. Se ficar alguma dúvida, fale com a gente.</p>
          <Button asChild size="lg" variant="outline" className="mt-8 rounded-full">
            <Link to="/auth">Falar com a equipe <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </FadeIn>
        <FadeIn>
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className="overflow-hidden rounded-2xl border border-border/60 bg-card px-5 data-[state=open]:border-primary/40 data-[state=open]:shadow-elegant">
                <AccordionTrigger className="text-left font-display text-lg font-medium hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </FadeIn>
      </div>

    </Section>
  );
}

/* ============================== FINAL CTA ============================== */
function FinalCTA() {
  return (
    <Section>
      <FadeIn>
        <div className="relative overflow-hidden rounded-[2.5rem] weaze-gradient px-6 py-20 text-center shadow-glow sm:px-16">
          <div className="absolute inset-0 -z-0 opacity-30" style={{ backgroundImage: "radial-gradient(600px 300px at 20% 0%, rgba(255,255,255,0.25), transparent 60%)" }} />
          <h2 className="font-display relative mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-primary-foreground sm:text-5xl">
            Seu próximo cliente já está com o celular na mão. Agora falta transformar essa visita em uma{" "}
            <span className="underline decoration-white/40 underline-offset-4">venda.</span>
          </h2>
          <p className="relative mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/85">
            Leve o autoatendimento inteligente para o seu negócio e descubra uma nova forma de vender, atender e crescer.
          </p>
          <div className="relative mt-10">
            <Button asChild size="lg" variant="secondary" className="rounded-full px-8 text-base shadow-elegant">
              <Link to="/auth">
                Quero experimentar a weaze <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

/* ============================== FOOTER ============================== */
function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo className="h-7" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Autoatendimento Inteligente para Negócios Locais. Transforme visitas em vendas, pagamentos e relacionamento.
            </p>
          </div>
          <FooterCol title="Produto" links={[["Recursos", "#recursos"], ["Planos", "#planos"], ["FAQ", "#faq"]]} />
          <FooterCol
            title="Empresa"
            links={[
              ["Contato", "mailto:contato@weaze.com.br"],
              ["Termos de Uso", "/termos"],
              ["Política de Privacidade", "/privacy"],
              ["Cookies", "/privacy#cookies"],
            ]}
          />
          <div>
            <h4 className="font-display text-sm font-semibold">Social</h4>
            <div className="mt-4 flex gap-3">
              <SocialIcon icon={Instagram} />
              <SocialIcon icon={Linkedin} />
              <SocialIcon icon={MessageSquareHeart} label="WhatsApp" />
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} weaze. Todos os direitos reservados.</p>
          <p>Feito para negócios que querem crescer.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="font-display text-sm font-semibold">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {links.map(([l, href]) => (
          <li key={l}>
            <a href={href} className="hover:text-foreground transition-colors">{l}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label?: string }) {
  return (
    <a href="#" aria-label={label} className="grid size-10 place-items-center rounded-full border border-border/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary">
      <Icon className="size-4" />
    </a>
  );
}

/* ============================== PRIMITIVES ============================== */
function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={"py-24 sm:py-32 " + (className ?? "")}>
      <div className="mx-auto max-w-7xl px-6">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
      {children}
    </div>
  );
}

function FadeIn({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
