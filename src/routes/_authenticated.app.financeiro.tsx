import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreditCard, Landmark, Loader2, QrCode, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { paymentService, type PaymentAccountPublic } from "@/services/payment";

export const Route = createFileRoute("/_authenticated/app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro — WEAZE" }] }),
});

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

const METHODS = [
  { key: "pix", label: "Receber Pix", icon: QrCode },
  { key: "card", label: "Receber Cartão", icon: CreditCard },
  { key: "cash", label: "Receber Dinheiro", icon: Landmark },
  { key: "counter", label: "Receber no Caixa", icon: Store },
];

function FinanceiroPage() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["payment-account"],
    queryFn: () => paymentService.getAccount(),
  });

  const account: PaymentAccountPublic | null = data?.status === "success" ? data.account : null;
  const isConnected = account?.status === "connected";

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await paymentService.connect("mercadopago");
      if (result.status === "success") {
        window.location.assign(result.url);
        return;
      }
      if (result.status === "unauthorized") {
        toast.error("Sua sessão expirou. Faça login novamente.");
      } else {
        toast.error("A integração com o Mercado Pago ainda não foi configurada.");
      }
      setConnecting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a conexão. Tente novamente.");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnectOpen(false);
    try {
      const result = await paymentService.disconnect();
      if (result.status === "success") {
        toast.success("Conta desconectada.");
        queryClient.invalidateQueries({ queryKey: ["payment-account"] });
      } else {
        toast.error("Não foi possível desconectar a conta. Tente novamente.");
      }
    } catch {
      toast.error("Não foi possível desconectar a conta. Tente novamente.");
    }
  }

  const statusRows: { label: string; value: string }[] = isConnected
    ? [
        { label: "Status da conexão", value: "Conectado" },
        { label: "Gateway conectado", value: "Mercado Pago" },
        { label: "Conta vinculada", value: account?.accountName ?? account?.accountId ?? "—" },
        { label: "Última sincronização", value: formatDateTime(account?.lastSyncAt ?? account?.updatedAt) },
      ]
    : [
        { label: "Status da conexão", value: "Não conectado" },
        { label: "Gateway conectado", value: "—" },
        { label: "Conta vinculada", value: "—" },
        { label: "Última sincronização", value: "—" },
      ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gateway de Pagamento</CardTitle>
          <CardDescription>
            Conecte um provedor de pagamentos para receber pedidos online.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connecting ? (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Conectando ao Mercado Pago...</p>
                <p className="text-sm text-muted-foreground">
                  Estamos redirecionando você para autorizar o acesso.
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando status...</p>
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Conectado</p>
                <p className="text-sm text-muted-foreground">
                  Sua conta do Mercado Pago está conectada e pronta para receber pagamentos.
                </p>
              </div>
              <Button variant="outline" onClick={() => setDisconnectOpen(true)}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <span className="size-2.5 rounded-full bg-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium">Nenhum gateway conectado</p>
                <p className="text-sm text-muted-foreground">
                  Conecte o Mercado Pago para começar a receber online.
                </p>
              </div>
              <Button onClick={handleConnect}>Conectar Mercado Pago</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status da Conta</CardTitle>
          <CardDescription>Informações da conta de pagamento vinculada.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {statusRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription>
            Formas de pagamento aceitas nos pedidos. Disponíveis em breve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {METHODS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Icon className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">Disponível em breve</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Em breve</Badge>
                <Switch disabled />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico Financeiro</CardTitle>
          <CardDescription>Registros de pagamentos e movimentações.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Forma de pagamento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desconectar Mercado Pago</DialogTitle>
            <DialogDescription>
              Você deixará de receber pagamentos online pelo Mercado Pago. O histórico financeiro
              será mantido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
