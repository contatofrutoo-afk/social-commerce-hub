import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { companyRepository, customerRepository, checkinRepository } from "@/repositories";
import type { VisitContext } from "@/repositories/types";
import { setSession, getSessionForCompany, getLastProfile, setLastProfile } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { User, Heart, Users, Home } from "lucide-react";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/c/$companySlug/")({
  component: CheckinPage,
});

const contexts: { id: VisitContext; label: string; icon: any }[] = [
  { id: "sozinho", label: "Sozinho", icon: User },
  { id: "casal", label: "Casal", icon: Heart },
  { id: "amigos", label: "Amigos", icon: Users },
  { id: "familia", label: "Família", icon: Home },
];



function CheckinPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [context, setContext] = useState<VisitContext | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;

  const checkinFired = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (checkinFired.current) return;
    checkinFired.current = true;

    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("t") ?? params.get("table") ?? "";

    checkinRepository
      .createAutoCheckin({
        customerId: session.customerId,
        sessionToken: session.sessionToken,
        companyId: session.companyId,
        tableId: tableId || undefined,
        source: tableId ? "mesa" : "link",
      })
      .then((created) => {
        console.log("[auto_checkin]", created ? "checkin criado" : "cooldown ativo, skip");
      })
      .catch((err) => {
        console.warn("[auto_checkin] erro:", err?.message ?? err);
      })
      .finally(async () => {
        await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      });
  }, [session, companySlug, navigate]);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });

  // Multi-tenant seamless switch: se não há sessão para esta loja mas o cliente
  // já se identificou em outra loja antes, reaproveita nome/whatsapp e faz
  // check-in automático sem exigir formulário.
  const autoOnboardFired = useRef(false);
  useEffect(() => {
    if (session) return;
    if (!company) return;
    if (autoOnboardFired.current) return;
    const profile = getLastProfile();
    if (!profile?.name || !profile?.whatsapp) return;
    autoOnboardFired.current = true;

    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("t") ?? params.get("table") ?? "";

    (async () => {
      try {
        const upserted = await customerRepository.upsertVisit({
          companyId: company.id,
          name: profile.name,
          whatsapp: profile.whatsapp,
        });
        setSession({
          customerId: upserted.customerId,
          companyId: company.id,
          companySlug,
          sessionToken: upserted.sessionToken,
          createdAt: Date.now(),
        });
        await checkinRepository.createAutoCheckin({
          customerId: upserted.customerId,
          sessionToken: upserted.sessionToken,
          companyId: company.id,
          tableId: tableId || undefined,
          source: tableId ? "mesa" : "link",
        });
      } catch (err: any) {
        console.warn("[auto_onboard]", err?.message ?? err);
      } finally {
        await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      }
    })();
  }, [session, company, companySlug, navigate]);

  const { data: existingCustomer } = useQuery({
    queryKey: ["customer-self", session?.customerId],
    queryFn: () => customerRepository.findSelf(session!.customerId, session!.sessionToken),
    enabled: !!session,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (existingCustomer) {
      setName(existingCustomer.name);
      setWhatsapp(existingCustomer.whatsapp);
    }
  }, [existingCustomer]);

  async function logConsent(customerId: string, companyId: string, sessionToken: string, consentType: string) {
    try {
      await supabase.rpc("log_consent", {
        _customer_id: customerId,
        _token: sessionToken,
        _company_id: companyId,
        _consent_type: consentType,
      });
    } catch (err) {
      console.warn("[consent]", consentType, err);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada");
      if (!context) throw new Error("Selecione como está sendo sua visita");
      if (!acceptTerms) throw new Error("Você precisa aceitar os Termos de Uso");
      if (!acceptPrivacy) throw new Error("Você precisa aceitar a Política de Privacidade");
      const nameValue = name.trim() || existingCustomer?.name || "";
      const whatsappValue = whatsapp.trim() || existingCustomer?.whatsapp || "";
      if (!nameValue) throw new Error("Preencha seu nome");
      if (!whatsappValue) throw new Error("Preencha seu WhatsApp");
      const upserted = await customerRepository.upsertVisit({
        companyId: company.id,
        name: nameValue,
        whatsapp: whatsappValue,
      });
      setSession({
        customerId: upserted.customerId,
        companyId: company.id,
        companySlug,
        sessionToken: upserted.sessionToken,
        createdAt: Date.now(),
      });
      setLastProfile({ name: nameValue, whatsapp: whatsappValue });
      await checkinRepository.create({
        customerId: upserted.customerId,
        sessionToken: upserted.sessionToken,
        companyId: company.id,
        context,
        source: "loja",
      });
      await logConsent(upserted.customerId, company.id, upserted.sessionToken, "terms_of_use");
      await logConsent(upserted.customerId, company.id, upserted.sessionToken, "privacy_policy");
      await logConsent(upserted.customerId, company.id, upserted.sessionToken, "checkin_privacy");
    },
    onSuccess: async () => {
      await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
      navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao entrar"),
  });

  if (isLoading) return <div className="p-8 text-center">Carregando…</div>;
  if (!company) return <div className="p-8 text-center">Estabelecimento não encontrado</div>;

  return (
    <div className="weaze-hero-gradient min-h-screen px-6 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-10 text-center">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={company.name}
              className="mx-auto size-20 rounded-2xl object-cover shadow-elegant ring-1 ring-border"
            />
          ) : (
            <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-card shadow-elegant ring-1 ring-border">
              <Logo className="h-10" />
            </div>
          )}
          <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
            {company.welcomeMessage}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {company.name} · Faça seu check-in em segundos
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como podemos te chamar?"
              className="mt-1.5"
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="wa">WhatsApp</Label>
            <Input
              id="wa"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 90000-0000"
              className="mt-1.5"
              maxLength={20}
            />
          </div>

          <div>
            <Label>Como está sendo sua visita hoje?</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {contexts.map((c) => {
                const active = context === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setContext(c.id)}
                    className={`flex items-center gap-2 rounded-xl border-2 p-4 text-left transition ${
                      active
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <c.icon className="size-5" />
                    <span className="font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ao continuar, você confirma que leu e aceita os termos abaixo. Seus dados
              serão usados apenas para melhorar sua experiência e gerar análises para
              este estabelecimento.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={acceptTerms}
                onCheckedChange={(v) => setAcceptTerms(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Li e aceito os{" "}
                <a href="/termos" target="_blank" className="underline underline-offset-2 hover:text-primary">
                  Termos de Uso
                </a>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={acceptPrivacy}
                onCheckedChange={(v) => setAcceptPrivacy(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Li e aceito a{" "}
                <a href="/privacidade" target="_blank" className="underline underline-offset-2 hover:text-primary">
                  Política de Privacidade
                </a>
              </span>
            </label>
          </div>

          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !context ||
              (!name.trim() && !existingCustomer?.name) ||
              (!whatsapp.trim() && !existingCustomer?.whatsapp) ||
              !acceptTerms ||
              !acceptPrivacy
            }
          >
            {mutation.isPending ? "Entrando…" : "Entrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
