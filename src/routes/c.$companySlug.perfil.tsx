import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { customerRepository } from "@/repositories";
import { getSessionForCompany, clearSession, clearLastProfile } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { uploadCustomerFile } from "@/lib/customer-uploads.functions";
import { fileToBase64 } from "@/lib/file-utils";
import { toast } from "sonner";
import { Mars, Venus, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;

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
    }
  }, [customer]);

  async function handleAvatarUpload(file: File | undefined) {
    if (!file || !session) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    if (!ALLOWED.includes(file.type as any)) { toast.error("Formato não suportado."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB."); return; }
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
    mutationFn: () =>
      customerRepository.updateSelf(session!.customerId, session!.sessionToken, {
        name,
        whatsapp,
        avatarUrl: avatarUrl || null,
        gender,
        ageRange,
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["customer-self"] });
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      navigate({ to: "/c/$companySlug", params: { companySlug } });
    }
  }, [session, companySlug, navigate]);

  if (!session) return null;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer">
          <div className="size-16 overflow-hidden rounded-full bg-accent">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
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


        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Salvar
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full text-destructive"
        onClick={() => {
          clearSession();
          clearLastProfile();
          navigate({ to: "/c/$companySlug", params: { companySlug } });
        }}
      >
        Sair
      </Button>
    </div>
  );
}
