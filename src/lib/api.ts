/**
 * Cliente HTTP de Clozr Web → cf-worker (API REST CRUD multi-tenant en prod).
 *
 * Equivalente web de la capa `lib/db/` del desktop: funciones de dominio,
 * pero haciendo fetch al Worker. El JWT viaja en `Authorization: Bearer`.
 * El mapeo snake_case (DB/Worker) ↔ camelCase (UI) se hace acá.
 */
import type {
  Currency,
  Customer,
  LeadPriority,
  LeadSource,
  PipelineItem,
  PipelineStage,
  Sale,
  SaleDetail,
  SaleItem,
  SalePayment,
  User,
  Workspace,
} from "./types";
import { SEED_STAGES } from "./types";

export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ?? "https://clozr-auth.pyter-import.workers.dev";

const TOKEN_KEY = "clozr_jwt";
const WS_KEY = "clozr_ws";

/* ---------- sesión (browser) ---------- */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(jwt: string) {
  localStorage.setItem(TOKEN_KEY, jwt);
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WS_KEY);
}
export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WS_KEY);
}
export function setWorkspaceId(id: string) {
  localStorage.setItem(WS_KEY, id);
}

/* ---------- fetch helper ---------- */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(`${WORKER_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, (body && body.error) || `http_${res.status}`);
  }
  return body as T;
}

/* ---------- auth ---------- */
export async function requestCode(email: string): Promise<void> {
  await req("/auth/request", { method: "POST", body: JSON.stringify({ email }) });
}
export async function verifyCode(email: string, code: string): Promise<string> {
  const s = await req<{ jwt: string }>("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  setToken(s.jwt);
  return s.jwt;
}

/* ---------- me / workspaces ---------- */
interface MeRaw {
  user: { id: string; email: string; name: string | null; plan: string };
  workspaces: Array<{ id: string; name: string; role: string; status: string }>;
}
export async function fetchMe(): Promise<{ user: User; workspaces: Workspace[] }> {
  const r = await req<MeRaw>("/me");
  return {
    user: { id: r.user.id, email: r.user.email, name: r.user.name, plan: r.user.plan },
    workspaces: (r.workspaces ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      status: w.status,
    })),
  };
}
export async function createWorkspace(name: string): Promise<Workspace> {
  return req<Workspace>("/workspaces", { method: "POST", body: JSON.stringify({ name }) });
}

/* ---------- helpers de tenancy ---------- */
function ws(): string {
  const id = getWorkspaceId();
  if (!id) throw new ApiError(400, "no_workspace");
  return id;
}

/* ---------- customers ---------- */
interface CustomerRaw {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  type?: string | null;
  notes?: string | null;
  created_at?: string | null;
}
function mapCustomer(r: CustomerRaw): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    type: (r.type as Customer["type"]) ?? "final",
    notes: r.notes ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}
export async function listCustomers(): Promise<Customer[]> {
  const r = await req<{ customers: CustomerRaw[] }>(`/workspaces/${ws()}/customers`);
  return (r.customers ?? []).map(mapCustomer);
}
export async function createCustomer(data: Partial<Customer>): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/customers`, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      type: data.type ?? "final",
      notes: data.notes ?? null,
    }),
  });
  return r.id;
}
export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  await req(`/workspaces/${ws()}/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.notes !== undefined && { notes: data.notes }),
    }),
  });
}
export async function deleteCustomer(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/customers/${id}`, { method: "DELETE" });
}

/* ---------- pipeline: stages ---------- */
interface StageRaw {
  id: string;
  name: string;
  stage_order?: number | null;
  color?: string | null;
  is_won?: number | null;
  is_lost?: number | null;
}
function mapStage(r: StageRaw): PipelineStage {
  return {
    id: r.id,
    name: r.name,
    color: r.color ?? "#64748B",
    order: Number(r.stage_order ?? 0),
    isWon: !!r.is_won,
    isLost: !!r.is_lost,
  };
}
export async function listStages(): Promise<PipelineStage[]> {
  const r = await req<{ stages: StageRaw[] }>(`/workspaces/${ws()}/pipeline/stages`);
  return (r.stages ?? []).map(mapStage).sort((a, b) => a.order - b.order);
}
export async function createStage(s: {
  id?: string;
  name: string;
  color: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
}): Promise<void> {
  await req(`/workspaces/${ws()}/pipeline/stages`, {
    method: "POST",
    body: JSON.stringify({
      id: s.id,
      name: s.name,
      color: s.color,
      stage_order: s.order,
      is_won: s.isWon ? 1 : 0,
      is_lost: s.isLost ? 1 : 0,
    }),
  });
}
/** Siembra las 7 etapas canónicas en un workspace recién creado. */
export async function seedDefaultStages(): Promise<void> {
  for (const s of SEED_STAGES) {
    await createStage(s);
  }
}

/* ---------- pipeline: items (oportunidades) ---------- */
interface ItemRaw {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  stage_id: string;
  stage_name?: string | null;
  stage_order?: number | null;
  estimated_value?: number | null;
  currency?: string | null;
  product?: string | null;
  priority?: string | null;
  lead_source?: string | null;
  created_at?: string | null;
}
function mapItem(r: ItemRaw): PipelineItem {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name ?? "",
    stageId: r.stage_id,
    stageName: r.stage_name ?? "",
    stageOrder: Number(r.stage_order ?? 0),
    amount: r.estimated_value ?? null,
    currency: (r.currency as Currency) ?? "ARS",
    product: r.product ?? undefined,
    priority: (r.priority as LeadPriority) ?? "medium",
    source: (r.lead_source as LeadSource) ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}
export async function listItems(): Promise<PipelineItem[]> {
  const r = await req<{ items: ItemRaw[] }>(`/workspaces/${ws()}/pipeline/items`);
  return (r.items ?? []).map(mapItem);
}

interface ItemInput {
  customerId: string;
  customerName: string;
  stage: PipelineStage;
  amount?: number | null;
  currency: Currency;
  product?: string;
  priority: LeadPriority;
  source?: LeadSource;
}
function itemBody(d: Partial<ItemInput>) {
  const body: Record<string, unknown> = {};
  if (d.customerId !== undefined) body.customer_id = d.customerId;
  if (d.customerName !== undefined) body.customer_name = d.customerName;
  if (d.stage !== undefined) {
    body.stage_id = d.stage.id;
    body.stage_name = d.stage.name;
    body.stage_order = d.stage.order;
  }
  if (d.amount !== undefined) body.estimated_value = d.amount;
  if (d.currency !== undefined) body.currency = d.currency;
  if (d.product !== undefined) body.product = d.product ?? null;
  if (d.priority !== undefined) body.priority = d.priority;
  if (d.source !== undefined) body.lead_source = d.source ?? null;
  return body;
}
export async function createItem(d: ItemInput): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/pipeline/items`, {
    method: "POST",
    body: JSON.stringify(itemBody(d)),
  });
  return r.id;
}
export async function updateItem(id: string, d: Partial<ItemInput>): Promise<void> {
  await req(`/workspaces/${ws()}/pipeline/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(itemBody(d)),
  });
}
export async function moveItem(id: string, stage: PipelineStage): Promise<void> {
  await req(`/workspaces/${ws()}/pipeline/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ stage_id: stage.id, stage_name: stage.name, stage_order: stage.order }),
  });
}
export async function deleteItem(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/pipeline/items/${id}`, { method: "DELETE" });
}

/* ---------- sales (ventas) ---------- */
interface SaleRaw {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  seller_name?: string | null;
  subtotal?: number | null;
  total?: number | null;
  total_paid?: number | null;
  balance?: number | null;
  is_paid?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  sale_date?: string | null;
  created_at?: string | null;
}
function mapSale(r: SaleRaw): Sale {
  return {
    id: r.id,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name ?? "Consumidor final",
    sellerName: r.seller_name ?? undefined,
    subtotal: Number(r.subtotal ?? 0),
    total: Number(r.total ?? 0),
    totalPaid: Number(r.total_paid ?? 0),
    balance: Number(r.balance ?? 0),
    isPaid: !!r.is_paid,
    paymentMethod: r.payment_method ?? undefined,
    notes: r.notes ?? undefined,
    saleDate: r.sale_date ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

interface SaleItemRaw {
  id: string;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
}
function mapSaleItem(r: SaleItemRaw): SaleItem {
  return {
    id: r.id,
    description: r.description,
    quantity: Number(r.quantity ?? 1),
    unitPrice: Number(r.unit_price ?? 0),
    subtotal: Number(r.subtotal ?? 0),
  };
}

interface SalePaymentRaw {
  id: string;
  method: string;
  currency?: string | null;
  amount?: number | null;
  is_deposit?: number | null;
}
function mapSalePayment(r: SalePaymentRaw): SalePayment {
  return {
    id: r.id,
    method: r.method,
    currency: (r.currency as Currency) ?? "ARS",
    amount: Number(r.amount ?? 0),
    isDeposit: !!r.is_deposit,
  };
}

export async function listSales(): Promise<Sale[]> {
  const r = await req<{ sales: SaleRaw[] }>(`/workspaces/${ws()}/sales`);
  return (r.sales ?? []).map(mapSale);
}

export async function getSale(id: string): Promise<SaleDetail> {
  const r = await req<{ sale: SaleRaw; items: SaleItemRaw[]; payments: SalePaymentRaw[] }>(
    `/workspaces/${ws()}/sales/${id}`,
  );
  return {
    ...mapSale(r.sale),
    items: (r.items ?? []).map(mapSaleItem),
    payments: (r.payments ?? []).map(mapSalePayment),
  };
}

export interface NewSaleInput {
  customerId?: string;
  customerName: string;
  sellerName?: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  payments: Array<{ method: string; amount: number; currency: Currency }>;
}

export async function createSale(input: NewSaleInput): Promise<string> {
  // El Worker NO calcula totales en POST (sí en addPayment) — los mandamos
  // calculados desde acá. Venta en ARS por ahora (el schema sale no guarda
  // moneda; la moneda vive en cada pago). Multi-moneda = feature pendiente.
  const items = input.items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    subtotal: i.quantity * i.unitPrice,
  }));
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const total = subtotal;
  const totalPaid = input.payments.reduce((a, p) => a + p.amount, 0);
  const balance = total - totalPaid;
  const paymentMethod =
    input.payments.length === 1
      ? input.payments[0]!.method
      : input.payments.length > 1
        ? "multiple"
        : "cuenta-corriente";

  const r = await req<{ id: string }>(`/workspaces/${ws()}/sales`, {
    method: "POST",
    body: JSON.stringify({
      customer_id: input.customerId ?? null,
      customer_name: input.customerName,
      seller_name: input.sellerName ?? null,
      subtotal,
      total,
      total_paid: totalPaid,
      balance,
      is_paid: balance <= 0.01 ? 1 : 0,
      payment_method: paymentMethod,
      notes: input.notes ?? null,
      sale_date: new Date().toISOString(),
      items,
      payments: input.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        currency: p.currency,
      })),
    }),
  });
  return r.id;
}

export async function addPayment(
  saleId: string,
  p: { method: string; amount: number; currency: Currency },
): Promise<void> {
  // El Worker recalcula total_paid/balance/is_paid al agregar el pago.
  await req(`/workspaces/${ws()}/sales/${saleId}/payments`, {
    method: "POST",
    body: JSON.stringify({ method: p.method, amount: p.amount, currency: p.currency }),
  });
}

export async function deleteSale(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/sales/${id}`, { method: "DELETE" });
}
