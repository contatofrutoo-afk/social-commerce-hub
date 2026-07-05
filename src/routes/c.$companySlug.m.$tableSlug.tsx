import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  companyRepository,
  customerRepository,
  checkinRepository,
  tableRepository,
} from "@/repositories";
import type { VisitContext } from "@/repositories/types";
import { setSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Heart, Users, Home } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/m/$tableSlug")({
  component: TableCheckin,
});

const contexts: { id: VisitContext; label: string; icon: any }[] = [
  { id: "sozinho", label: "Sozinho", icon: User },
  { id: "casal", label: "Casal", icon: Heart },
  { id: "amigos", label: "Amigos", icon: Users },
  { id: "familia", label: "Família", icon: Home },
];

function TableCheckin() {
  const { companySlug, tableSlug } = Route.useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [context, setContext] = useState<VisitContext | null>(null);

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const { data: table } = useQuery({
    queryKey: ["table", company?.id, tableSlug],
    queryFn: () => (company ? tableRepository.findBySlug(company.id, tableSlug) : null),
    enabled: !!company,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company || !table) throw new Error("Mesa não encontrada");
      if (!name || !whatsapp || !context) throw new Error("Preencha todos os campos");
      const customer = await customerRepository.upsertByWhatsapp({
        companyId: company.id,
        name,
        whatsapp,
      });
      await checkinRepository.create({
        customerId: customer.id,
        companyId: company.id,
        context,
        tableId: table.id,
        source: `mesa-${table.slug}`,
      });
      setSession({ customerId: customer.id, companyId: company.id, companySlug });
      return customer;
    },
    onSuccess: () => {
      toast.success("Check-in realizado!");
      navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (!company || !table) return <div className="p-8 text-center">Carregando…</div>;

  return (
    <div className="px-6 py-8">
      <div className="mb-6 text-center">
        <div className="inline-block rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
          {table.label}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{company.welcomeMessage}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{company.name}</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Seu nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" maxLength={80} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="mt-1.5" maxLength={20} />
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
                  className={`flex items-center gap-2 rounded-xl border-2 p-4 ${
                    active ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <c.icon className="size-5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          Entrar
        </Button>
      </div>
    </div>
  );
}
