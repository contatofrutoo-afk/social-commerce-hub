import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { customerRepository } from "@/repositories";
import { getSessionForCompany, setSession, clearSession, clearLastProfile } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { uploadCustomerFile } from "@/lib/customer-uploads.functions";
import { getClientIp } from "@/lib/client-ip";
import { optimizedImageUrl } from "@/lib/image-url";
import { fileToBase64 } from "@/lib/file-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mars, Venus, HelpCircle, Shield, Download, Trash2, FileText, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSessionState] = useState(() =>
    typeof window !== "undefined" ? getSessionForCompany(companySlug) : null,
  );

  const { data: customer } = useQuery({
    queryKey: ["customer-self", session?.customerId],
    queryFn: () => customerRepository.findSelf(session!.customerId, session!.sessionToken),
    enabled: !!session,
  });
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showProfileNudge, setShowProfileNudge] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const uploadFile = useServerFn(uploadCustomerFile);

  const genderOptions = [
    { id: "mulher", label: "Mulher", icon: Venus },
    { id: "homem", label: "Homem", icon: Mars },
    { id: "prefiro_nao_informar", label: "Prefiro não informar", icon: HelpCircle },
  ];

  const ageRangeOptions = [
    { id: "ate_17", label: "Até 17 anos" },
    { id: "18-24", label: "18–24 anos" },
    { id: "25-34", label: "25–34 anos" },
    { id: "35-44", label: "35–44 anos" },
    { id: "45-54", label: "45–54 anos" },
    { id: "55_mais", label: "55 anos ou mais" },
  ];

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setWhatsapp(customer.whatsapp);
      setAvatarUrl(customer.avatarUrl ?? "");
      setGender(customer.gender ?? null);
      setAgeRange(customer.ageRange ?? null);
      if (customer.visitCount >= 3 && !customer.gender && !customer.ageRange) {
        setShowProfileNudge(true);
      }
    }
  }, [customer]);

  async function handleAvatarUpload(file: File | undefined) {
    if (!file || !session) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    if (!ALLOWED.includes(file.type as any)) { toast.error("Formato não suportado."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB."); return; }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const { url } = await uploadFile({
        data: {
          customerId: session.customerId,
          sessionToken: session.sessionToken,
          kind: "avatar",
          mimeType: file.type as (typeof ALLOWED)[number],
          fileName: file.name,
          base64,
        },
      });
      setAvatarUrl(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const ip = await getClientIp();
      return customerRepository.updateSelf(
        session!.customerId,
        session!.sessionToken,
        {
          name,
          whatsapp,
          avatarUrl: avatarUrl || null,
          gender,
          ageRange,
        },
        ip,
      );
    },
    onSuccess: (res) => {
      toast.success("Perfil atualizado");
      setShowProfileNudge(false);
      if (res && session && res.customerId !== session.customerId) {
        const next = { ...session, customerId: res.customerId, sessionToken: res.sessionToken };
        setSession(next);
        setSessionState(next);
      }
      qc.invalidateQueries({ queryKey: ["customer-self"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar perfil"),
  });

  const updateConsents = useMutation({
    mutationFn: async () => {
      for (const type of ["terms", "privacy"]) {
        await supabase.rpc("log_consent", {
          _customer_id: session!.customerId,
          _token: session!.sessionToken,
          _company_id: session!.companyId,
          _consent_type: type,
        });
      }
    },
    onSuccess: () => toast.success("Consentimentos atualizados"),
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar consentimentos"),
  });

  const deleteData = useMutation({
    mutationFn: async () => {
      await supabase.rpc("delete_my_data", {
        _customer_id: session!.customerId,
        _token: session!.sessionToken,
        _company_id: session!.companyId,
      });
    },
    onSuccess: () => {
      toast.success("Seus dados foram anonimizados");
      clearSession();
      clearLastProfile();
      navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao excluir dados"),
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
    }
  }, [session, companySlug, navigate]);

  if (!session) return null;

  return (
    <div className="space-y-6 p-4">
      {showProfileNudge && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Que tal completar seu perfil?</p>
          <p className="mt-1 text-muted-foreground">
            Informar seu gênero e faixa etária nos ajuda a oferecer uma experiência
            mais personalizada. É rápido e opcional.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer">
          <div className="size-16 overflow-hidden rounded-full bg-accent">
            {avatarUrl ? (
              <img src={optimizedImageUrl(avatarUrl, 64)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                {uploading ? (
                  <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
          />
        </label>
        <div>
          <div className="font-semibold">{customer?.name}</div>
          <div className="text-xs text-muted-foreground">
            {customer?.visitCount} visita{(customer?.visitCount ?? 0) > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} />
        </div>

        <div>
          <Label>Gênero <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {genderOptions.map((g) => {
              const active = gender === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGender(active ? null : g.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border-2 p-2.5 text-sm transition ${
                    active
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <g.icon className="size-4" />
                  <span className="text-xs font-medium">{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Faixa etária <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {ageRangeOptions.map((a) => {
              const active = ageRange === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgeRange(active ? null : a.id)}
                  className={`rounded-xl border-2 p-2.5 text-sm transition ${
                    active
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="text-xs font-medium">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          Salvar
        </Button>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="size-4 text-primary" /> Privacidade
        </h3>
        <button
          onClick={() => window.open("/privacy", "_blank")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <FileText className="size-4 text-muted-foreground" />
          Política de Privacidade
        </button>
        <button
          onClick={() => window.open("/termos", "_blank")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <FileText className="size-4 text-muted-foreground" />
          Termos de Uso
        </button>
        <button
          onClick={() => updateConsents.mutate()}
          disabled={updateConsents.isPending}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="size-4 text-muted-foreground" />
          {updateConsents.isPending ? "Atualizando..." : "Atualizar consentimentos"}
        </button>
        <button
          onClick={() => {
            if (window.confirm("Baixar meus dados? Esta funcionalidade estará disponível em breve.")) {
              toast.info("Funcionalidade em desenvolvimento");
            }
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <Download className="size-4 text-muted-foreground" />
          Solicitar exportação dos meus dados
        </button>

        <button
          onClick={() => {
            if (window.confirm("Tem certeza? Seus dados serão anonimizados e não poderão ser recuperados.")) {
              setDeleting(true);
              deleteData.mutate();
            }
          }}
          disabled={deleting}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-4" />
          {deleting ? "Excluindo..." : "Excluir meus dados"}
        </button>
      </div>

      <Button
        variant="ghost"
        className="w-full text-destructive"
        onClick={() => {
          clearSession();
          clearLastProfile();
          navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
        }}
      >
        Sair
      </Button>
    </div>
  );
}
