import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { customerRepository } from "@/repositories";
import { getSessionForCompany, clearSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setWhatsapp(customer.whatsapp);
      setAvatarUrl(customer.avatarUrl ?? "");
    }
  }, [customer]);

  async function handleAvatarUpload(file: File | undefined) {
    if (!file) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED.includes(file.type)) { toast.error("Formato não suportado."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `avatars/${session!.customerId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("weaze-private").upload(path, file);
      if (error) throw error;
      // Bucket privado: gera signed URL de 1 ano (limite máximo do Storage).
      const { data: signed, error: signErr } = await supabase.storage
        .from("weaze-private")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL do avatar");
      setAvatarUrl(signed.signedUrl);
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
          navigate({ to: "/c/$companySlug", params: { companySlug } });
        }}
      >
        Sair
      </Button>
    </div>
  );
}
