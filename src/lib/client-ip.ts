// Resolve o IP público do cliente no servidor (SSR), a partir dos headers
// de proxy. Usado para vincular acessos do mesmo usuário entre aparelhos
// (celular e PC) que compartilham o mesmo IP.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function normalizeClientIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  // IPv6 entre colchetes (ex.: [2001:db8::1]:443) → mantém só o endereço
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end === -1) return null;
    return value.slice(1, end);
  }
  // IPv4 com porta (ex.: 189.4.2.1:54321) → remove a porta
  const ipv4Port = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/;
  const match = value.match(ipv4Port);
  if (match) return match[1];
  return value;
}

export const getClientIp = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const request = getRequest();
    const headers = request?.headers;
    if (!headers) return null;
    const forwarded = headers.get("x-forwarded-for");
    const first = forwarded ? forwarded.split(",")[0].trim() : null;
    const raw = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? first ?? null;
    return normalizeClientIp(raw);
  } catch {
    return null;
  }
});
