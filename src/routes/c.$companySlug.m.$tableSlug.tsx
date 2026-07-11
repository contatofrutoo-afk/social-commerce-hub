import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  companyRepository,
  customerRepository,
  checkinRepository,
  tableRepository,
} from "@/repositories";
import type { VisitContext } from "@/repositories/types";
import { setSession, getSessionForCompany } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Heart, Users, Home } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });

  const { data: table, isLoading: tableLoading, error: tableError } = useQuery({
    queryKey: ["table", company?.id, tableSlug],
    queryFn: () => (company ? tableRepository.findBySlug(company.id, tableSlug) : null),
    enabled: !!company,
    staleTime: 30_000,
  });

  const checkinFired = useRef(false);
  useEffect(() => {
    if (!session || !company || !table) {
      if (session && company && table === undefined) {
        console.warn("[mesa_checkin] table not found for slug:", tableSlug, "company:", company?.id);
      }
      return;
    }
    if (checkinFired.current) return;
    checkinFired.current = true;

    console.log("[mesa_checkin] firing auto_checkin", {
      customerId: session.customerId,
      companyId: session.companyId,
      tableId: table.id,
      tableSlug: table.slug,
      source: `mesa-${table.slug}`,
    });

    checkinRepository
      .createAutoCheckin({
        customerId: session.customerId,
        sessionToken: session.sessionToken,
        companyId: session.companyId,
        tableId: table.id,
        source: `mesa-${table.slug}`,
      })
      .then((created) => {
        console.log("[mesa_checkin]", created ? "checkin criado" : "cooldown ativo, skip");
      })
      .catch((err) => {
        console.warn("[mesa_checkin] erro:", err?.message ?? err);
      })
      .finally(() => {
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      });
  }, [session, company, table, companySlug, navigate, tableSlug]);

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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company || !table) throw new Error("Mesa não encontrada");
      if (!context) throw new Error("Selecione como está sendo sua visita");
      const nameValue = name.trim() || existingCustomer?.name || "";
      const whatsappValue = whatsapp.trim() || existingCustomer?.whatsapp || "";
      if (!nameValue) throw new Error("Preencha seu nome");
      if (!whatsappValue) throw new Error("Preencha seu WhatsApp");
      const upserted = await customerRepository.upsertVisit({
        companyId: company.id,
        name: nameValue,
        whatsapp: whatsappValue,
      });
      await checkinRepository.create({
        customerId: upserted.customerId,
        sessionToken: upserted.sessionToken,
        companyId: company.id,
        context,
        tableId: table.id,
        source: `mesa-${table.slug}`,
      });
      setSession({
        customerId: upserted.customerId,
        companyId: company.id,
        companySlug,
        sessionToken: upserted.sessionToken,
        createdAt: Date.now(),
      });
    },
    onSuccess: () => {
      navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (!company || !table) {
    if (tableError) {
      console.warn("[mesa_checkin] table query error:", tableError.message);
      return (
        <div className="px-6 py-8 text-center space-y-3">
          <p className="text-destructive font-medium">Mesa não encontrada</p>
          <p className="text-sm text-muted-foreground">
            Verifique o link ou entre em contato com o estabelecimento.
          </p>
        </div>
      );
    }
    if (company && !tableLoading && table === null) {
      return (
        <div className="px-6 py-8 text-center space-y-3">
          <p className="text-destructive font-medium">Mesa "{tableSlug}" não encontrada</p>
          <p className="text-sm text-muted-foreground">
            Esta mesa não existe em {company.name}. Verifique o link.
          </p>
        </div>
      );
    }
    return (
      <div className="px-6 py-8">
        <div className="mb-6 text-center space-y-3">
          <Skeleton className="mx-auto h-6 w-24 rounded-full" />
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-1.5 h-10 w-full rounded-md" />
          </div>
          <div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-1.5 h-10 w-full rounded-md" />
          </div>
          <div>
            <Skeleton className="h-4 w-56" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    );
  }

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
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5"
            maxLength={80}
          />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
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
          disabled={
            mutation.isPending ||
            !context ||
            (!name.trim() && !existingCustomer?.name) ||
            (!whatsapp.trim() && !existingCustomer?.whatsapp)
          }
        >
          {mutation.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </div>
    </div>
  );
}
