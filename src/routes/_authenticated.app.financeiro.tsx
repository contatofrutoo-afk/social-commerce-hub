import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Landmark, QrCode, Store } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro — WEAZE" }] }),
});

const ACCOUNT_STATUS: { label: string; value: string }[] = [
  { label: "Status da conexão", value: "Não conectado" },
  { label: "Gateway conectado", value: "—" },
  { label: "Última sincronização", value: "—" },
  { label: "Conta vinculada", value: "—" },
];

const METHODS = [
  { key: "pix", label: "Receber Pix", icon: QrCode },
  { key: "card", label: "Receber Cartão", icon: CreditCard },
  { key: "cash", label: "Receber Dinheiro", icon: Landmark },
  { key: "counter", label: "Receber no Caixa", icon: Store },
];

function FinanceiroPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <span className="size-2.5 rounded-full bg-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium">Nenhum gateway conectado</p>
              <p className="text-sm text-muted-foreground">
                Conecte o Mercado Pago para começar a receber online.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>Conectar Mercado Pago</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status da Conta</CardTitle>
          <CardDescription>Informações da conta de pagamento vinculada.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {ACCOUNT_STATUS.map((row) => (
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Mercado Pago</DialogTitle>
            <DialogDescription>
              A integração com o Mercado Pago será configurada na próxima etapa do projeto.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
