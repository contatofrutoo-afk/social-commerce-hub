import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { companyRepository, customerRepository, checkinRepository } from "@/repositories";
import type { VisitContext } from "@/repositories/types";
import { setSession, getSessionForCompany } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Heart, Users, Home } from "lucide-react";

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
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [context, setContext] = useState<VisitContext | null>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada");
      if (!name.trim() || !whatsapp.trim() || !context) throw new Error("Preencha todos os campos");
      const customer = await customerRepository.upsertByWhatsapp({
        companyId: company.id,
        name: name.trim(),
        whatsapp: whatsapp.trim(),
      });
      await checkinRepository.create({
        customerId: customer.id,
        companyId: company.id,
        context,
      });
      setSession({ customerId: customer.id, companyId: company.id, companySlug });
      return customer;
    },
    onSuccess: () => {
      toast.success("Check-in realizado!");
      navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao entrar"),
  });

  if (isLoading) return <div className="p-8 text-center">Carregando…</div>;
  if (!company) return <div className="p-8 text-center">Estabelecimento não encontrado</div>;

  // Se já tem sessão, pula pra o feed
  if (typeof window !== "undefined" && getSessionForCompany(companySlug)) {
    navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
          W
        </div>
        <h1 className="mt-4 text-2xl font-bold">{company.welcomeMessage}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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

        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name || !whatsapp || !context}
        >
          {mutation.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </div>
    </div>
  );
}
