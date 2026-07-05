import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { companyRepository, postRepository } from "@/repositories";
import type { VisitContext } from "@/repositories/types";
import { getSessionForCompany } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$companySlug/publicar")({
  component: PublishPage,
});

const contexts: VisitContext[] = ["sozinho", "casal", "amigos", "familia"];
const categories = ["Prato", "Bebida", "Momento", "Pet", "Amigos", "Família"];

function PublishPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = typeof window !== "undefined" ? getSessionForCompany(companySlug) : null;

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });

  const [imageUrl, setImageUrl] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [companions, setCompanions] = useState<VisitContext | null>(null);

  const publish = useMutation({
    mutationFn: async () => {
      if (!company || !session) throw new Error("Sessão inválida");
      if (!imageUrl && !text) throw new Error("Adicione uma imagem ou texto");
      return postRepository.createCustomerPost({
        companyId: company.id,
        customerId: session.customerId,
        text,
        imageUrl: imageUrl || null,
        category: category ?? undefined,
        companions: companions ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success("Publicação enviada!");
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!session) {
    if (typeof window !== "undefined") navigate({ to: "/c/$companySlug", params: { companySlug } });
    return null;
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Compartilhe sua experiência</h1>
      <div>
        <Label>URL da imagem</Label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label>Conte como está sendo</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label>Categoria</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-sm ${
                category === c ? "border-primary bg-accent" : ""
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Quem está com você</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {contexts.map((c) => (
            <button
              key={c}
              onClick={() => setCompanions(c)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${
                companions === c ? "border-primary bg-accent" : ""
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <Button
        size="lg"
        className="w-full"
        onClick={() => publish.mutate()}
        disabled={publish.isPending}
      >
        Publicar
      </Button>
    </div>
  );
}
