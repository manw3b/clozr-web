/**
 * Cliente HTTP de Clozr Web → cf-worker (API REST CRUD multi-tenant en prod).
 *
 * Equivalente web de la capa `lib/db/` del desktop: funciones de dominio,
 * pero haciendo fetch al Worker. El JWT viaja en `Authorization: Bearer`.
 * El mapeo snake_case (DB/Worker) ↔ camelCase (UI) se hace acá.
 */
import type {
  CatalogPrice,
  ClientType,
  CustomerType,
  CustomerTag,
  Currency,
  CashKind,
  CashMovement,
  CashSession,
  CashBuckets,
  Customer,
  LeadPriority,
  LeadSource,
  Member,
  PaymentOption,
  PipelineItem,
  PipelineStage,
  Product,
  Sale,
  SaleDetail,
  SaleItemReport,
  SaleItem,
  SalePayment,
  Followup,
  Task,
  TaskType,
  User,
  Workspace,
  Origin,
  Appointment,
  AppointmentType,
  Repair,
  RepairStatus,
} from "./types";
import { stagesForIndustry } from "./types";

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
  user: { id: string; email: string; name: string | null; plan: string; is_superadmin?: boolean };
  workspaces: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    daily_goal?: number | null;
    daily_goal_currency?: string | null;
    daily_goal_count?: number | null;
    industry?: string | null;
    logo_key?: string | null;
    banner_key?: string | null;
    icon?: string | null;
    unlocked_catalogs?: string[] | null;
    discount?: { type: string; value: number; target: string } | null;
    plan?: string | null;
    seats?: number | null;
    plan_status?: string | null;
    billing_interval?: string | null;
    covered_by?: string | null;
    address?: string | null;
  }>;
}
export async function fetchMe(): Promise<{ user: User; workspaces: Workspace[] }> {
  const r = await req<MeRaw>("/me");
  return {
    user: {
      id: r.user.id,
      email: r.user.email,
      name: r.user.name,
      plan: r.user.plan,
      isSuperAdmin: !!r.user.is_superadmin,
    },
    workspaces: (r.workspaces ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      status: w.status,
      dailyGoal: Number(w.daily_goal ?? 0),
      dailyGoalCurrency: w.daily_goal_currency ?? "ARS",
      dailyGoalCount: Number(w.daily_goal_count ?? 0),
      industry: w.industry ?? undefined,
      logoKey: w.logo_key ?? null,
      bannerKey: w.banner_key ?? null,
      icon: w.icon ?? null,
      unlockedCatalogs: Array.isArray(w.unlocked_catalogs) ? w.unlocked_catalogs : [],
      discount: w.discount ?? null,
      plan: w.plan ?? "free",
      seats: Number(w.seats ?? 1),
      planStatus: w.plan_status ?? "active",
      billingInterval: w.billing_interval ?? "monthly",
      coveredBy: w.covered_by ?? null,
      address: w.address ?? null,
    })),
  };
}

/** PATCH /me — editar el nombre del usuario logueado. */
export async function updateMyName(name: string): Promise<void> {
  await req("/me", { method: "PATCH", body: JSON.stringify({ name }) });
}
interface WorkspaceRaw {
  id: string;
  name: string;
  role: string;
  status: string;
  plan?: string | null;
  seats?: number | null;
  plan_status?: string | null;
}
export async function createWorkspace(name: string): Promise<Workspace> {
  const r = await req<WorkspaceRaw>("/workspaces", { method: "POST", body: JSON.stringify({ name }) });
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    status: r.status,
    plan: r.plan ?? "free",
    seats: Number(r.seats ?? 1),
    planStatus: r.plan_status ?? "active",
  };
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
  instagram?: string | null;
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
    instagram: r.instagram ?? undefined,
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
      instagram: data.instagram ?? null,
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
      ...(data.instagram !== undefined && { instagram: data.instagram }),
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
/** Siembra el embudo del RUBRO en un workspace recién creado (F3). NO reusa
 *  ids fijos: en la nube `pipeline_stages.id` es PK GLOBAL (compartida entre
 *  workspaces), así que omitimos el id y el Worker genera uno único por etapa.
 *  Cae al template "generic" si el rubro no matchea. */
export async function seedStagesForIndustry(industry?: string | null): Promise<void> {
  for (const s of stagesForIndustry(industry)) {
    await createStage({ name: s.name, color: s.color, order: s.order, isWon: s.isWon, isLost: s.isLost });
  }
}
export async function updateStage(
  id: string,
  patch: { name?: string; color?: string; order?: number; isWon?: boolean; isLost?: boolean },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.color !== undefined) body.color = patch.color;
  if (patch.order !== undefined) body.stage_order = patch.order;
  if (patch.isWon !== undefined) body.is_won = patch.isWon ? 1 : 0;
  if (patch.isLost !== undefined) body.is_lost = patch.isLost ? 1 : 0;
  await req(`/workspaces/${ws()}/pipeline/stages/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}
export async function deleteStage(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/pipeline/stages/${id}`, { method: "DELETE" });
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
  visit_at?: string | null;
  next_action_at?: string | null;
  next_action_label?: string | null;
  short_note?: string | null;
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
    visitAt: r.visit_at ?? null,
    nextActionAt: r.next_action_at ?? null,
    nextActionLabel: r.next_action_label ?? null,
    shortNote: r.short_note ?? null,
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
  shortNote?: string | null;
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
  if (d.shortNote !== undefined) body.short_note = d.shortNote ?? null;
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
  order_seq?: number | null;
  order_day?: string | null;
  appointment_at?: string | null;
  origin?: string | null;
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
    saleDate: toIsoUtc(r.sale_date) || undefined,
    createdAt: toIsoUtc(r.created_at) || undefined,
    orderSeq: r.order_seq ?? null,
    orderDay: r.order_day ?? null,
    appointmentAt: r.appointment_at ?? null,
    origin: r.origin ?? null,
  };
}

interface SaleItemRaw {
  id: string;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
  imei?: string | null;
  currency?: string | null;
}
function mapSaleItem(r: SaleItemRaw): SaleItem {
  return {
    id: r.id,
    description: r.description,
    quantity: Number(r.quantity ?? 1),
    unitPrice: Number(r.unit_price ?? 0),
    subtotal: Number(r.subtotal ?? 0),
    imei: r.imei ?? null,
    currency: r.currency === "USD" ? "USD" : "ARS",
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
  items: Array<{ description: string; quantity: number; unitPrice: number; currency?: Currency; catalogItemId?: string | null; imei?: string | null; unitCost?: number | null }>;
  payments: Array<{ method: string; amount: number; currency: Currency }>;
  /** Cotización USD→ARS del momento, para convertir a pesos los ítems en USD. */
  usdToArs?: number;
  /** Plan canje: equipo usado recibido como parte de pago. Se crea como una
   *  unidad de catálogo (costo = valor de toma) al cerrar la venta. El crédito
   *  va aparte, como un pago con method "canje" en `payments`. */
  tradeIn?: { description: string; imei?: string; value: number; condition?: string; category?: string };
}

export async function createSale(input: NewSaleInput): Promise<string> {
  // El Worker NO calcula totales en POST (sí en addPayment) — los mandamos
  // calculados desde acá. El total de la venta es en ARS; cada ítem guarda su
  // moneda (ARS/USD) y los ítems en USD se convierten al dólar del momento.
  const rate = input.usdToArs && input.usdToArs > 0 ? input.usdToArs : 0;
  const items = input.items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    subtotal: i.quantity * i.unitPrice, // en la moneda del ítem
    currency: i.currency ?? "ARS",
    catalog_item_id: i.catalogItemId ?? null,
    imei: i.imei ?? null,
    unit_cost: i.unitCost ?? null,
  }));
  // Total en ARS: los ítems en USD se convierten al dólar del momento.
  const subtotal = items.reduce(
    (a, i) => a + (i.currency === "USD" && rate > 0 ? i.subtotal * rate : i.subtotal),
    0,
  );
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
      trade_in: input.tradeIn
        ? {
            description: input.tradeIn.description,
            imei: input.tradeIn.imei ?? null,
            value: input.tradeIn.value,
            condition: input.tradeIn.condition ?? null,
            category: input.tradeIn.category ?? null,
          }
        : undefined,
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

/** Envía el certificado de garantía por mail al cliente. */
export async function sendWarranty(
  saleId: string,
  p: { to: string; customerName: string; businessName: string; items: string; months: number; startDate: string },
): Promise<void> {
  await req(`/workspaces/${ws()}/sales/${saleId}/warranty`, {
    method: "POST",
    body: JSON.stringify(p),
  });
}

/* ---------- sale items (bulk, para Reportes v2) ---------- */
interface SaleItemReportRaw {
  id: string;
  sale_id: string;
  catalog_item_id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
  unit_cost?: number | null;
  sale_date?: string | null;
  sale_created_at?: string | null;
  seller_name?: string | null;
}
function mapSaleItemReport(r: SaleItemReportRaw): SaleItemReport {
  return {
    id: r.id,
    saleId: r.sale_id,
    catalogItemId: r.catalog_item_id ?? null,
    description: r.description ?? "",
    quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    subtotal: Number(r.subtotal ?? 0),
    // Snapshot del costo al momento de la venta (0 en ventas viejas → el
    // consumidor cae al costo actual del catálogo como fallback).
    unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
    saleDate: toIsoUtc(r.sale_date ?? r.sale_created_at) || null,
    sellerName: r.seller_name ?? null,
  };
}
export async function listSaleItems(): Promise<SaleItemReport[]> {
  const data = await req<{ items: SaleItemReportRaw[] }>(`/workspaces/${ws()}/sale-items`);
  return (data.items ?? []).map(mapSaleItemReport);
}

/* ---------- catalog prices (precios por tipo de cliente) ---------- */
interface CatalogPriceRaw {
  catalog_item_id: string;
  customer_type: string;
  price?: number | null;
}
export async function listCatalogPrices(): Promise<CatalogPrice[]> {
  const data = await req<{ prices: CatalogPriceRaw[] }>(`/workspaces/${ws()}/catalog-prices`);
  return (data.prices ?? [])
    .filter((p) => p.price != null)
    .map((p) => ({
      catalogItemId: p.catalog_item_id,
      customerType: p.customer_type as ClientType,
      price: Number(p.price),
    }));
}
/** Upsert del precio de un producto para un tipo. price null/<=0 = borrar. */
export async function setCatalogPrice(
  catalogItemId: string,
  customerType: ClientType,
  price: number | null,
): Promise<void> {
  await req(`/workspaces/${ws()}/catalog-prices`, {
    method: "PUT",
    body: JSON.stringify({ catalog_item_id: catalogItemId, customer_type: customerType, price }),
  });
}

export async function deleteSale(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/sales/${id}`, { method: "DELETE" });
}

/* ---------- tasks ---------- */
interface TaskRaw {
  id: string;
  title: string;
  type?: string | null;
  notes?: string | null;
  due_at?: string | null;
  completed?: number | null;
  assigned_to?: string | null;
  template_id?: string | null;
  customer_id?: string | null;
  created_at?: string | null;
}
function mapTask(r: TaskRaw): Task {
  return {
    id: r.id,
    title: r.title,
    type: r.type === "rutina" ? "rutina" : "puntual",
    notes: r.notes ?? undefined,
    dueAt: r.due_at ?? undefined,
    completed: r.completed === 1,
    assignedTo: r.assigned_to ?? undefined,
    templateId: r.template_id ?? undefined,
    customerId: r.customer_id ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

export async function listTasks(): Promise<Task[]> {
  const data = await req<{ items: TaskRaw[] }>(`/workspaces/${ws()}/tasks`);
  return (data.items ?? []).map(mapTask);
}

export async function createTask(input: {
  title: string;
  type: TaskType;
  dueAt?: string | null;
  assignedTo?: string | null;
}): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      type: input.type,
      due_at: input.dueAt ?? null,
      assigned_to: input.assignedTo ?? null,
    }),
  });
  return r.id;
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  await req(`/workspaces/${ws()}/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      completed: completed ? 1 : 0,
      completed_at: completed ? new Date().toISOString() : null,
    }),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/tasks/${id}`, { method: "DELETE" });
}

/* ---------- team / members ---------- */
interface MemberRaw {
  id: string;
  user_id?: string | null;
  email: string;
  role: string;
  status: string;
  invited_at?: string | null;
  accepted_at?: string | null;
  user_name?: string | null;
  source?: string | null;
}
function mapMember(r: MemberRaw): Member {
  return {
    id: r.id,
    userId: r.user_id ?? undefined,
    email: r.email,
    role: r.role,
    status: r.status,
    userName: r.user_name ?? undefined,
    invitedAt: r.invited_at ?? undefined,
    acceptedAt: r.accepted_at ?? undefined,
    source: r.source ?? undefined,
  };
}

export async function listMembers(): Promise<Member[]> {
  const data = await req<{ members: MemberRaw[] }>(`/workspaces/${ws()}/members`);
  return (data.members ?? []).map(mapMember);
}

export async function inviteMember(email: string, role: string): Promise<void> {
  await req(`/workspaces/${ws()}/invite`, { method: "POST", body: JSON.stringify({ email, role }) });
}

/**
 * POST /workspaces/:wid/billing/checkout — crea la suscripción (preapproval) en
 * Mercado Pago y devuelve el init_point para redirigir al checkout. Solo el
 * dueño (permiso billing.manage). Errores de MP: billing_unavailable (sin token)
 * / billing_upstream (MP rechazó).
 */
export async function createBillingCheckout(
  plan: "pro" | "team",
  extraSeats = 0,
  interval: "monthly" | "annual" = "monthly",
): Promise<{ initPoint: string; preapprovalId: string | null }> {
  const r = await req<{ init_point: string; preapproval_id?: string | null }>(
    `/workspaces/${ws()}/billing/checkout`,
    { method: "POST", body: JSON.stringify({ plan, extra_seats: extraSeats, interval }) },
  );
  return { initPoint: r.init_point, preapprovalId: r.preapproval_id ?? null };
}

/**
 * POST /workspaces/:wid/billing/seats — cambia los empleados extra sobre una
 * suscripción ACTIVA (sin re-checkout). El Worker actualiza el monto en MP y
 * persiste seats. Puede tirar ApiError "needs_recheckout" si MP no permite el
 * cambio de monto (requiere re-autorización del pagador).
 */
export async function updateSeats(extraSeats: number): Promise<{ seats: number; extraSeats: number }> {
  const r = await req<{ seats?: number; extra_seats?: number }>(
    `/workspaces/${ws()}/billing/seats`,
    { method: "POST", body: JSON.stringify({ extra_seats: extraSeats }) },
  );
  return { seats: Number(r.seats ?? 0), extraSeats: Number(r.extra_seats ?? 0) };
}

export async function patchMemberRole(memberId: string, role: string): Promise<void> {
  await req(`/workspaces/${ws()}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) });
}

export async function revokeMember(memberId: string): Promise<void> {
  await req(`/workspaces/${ws()}/members/${memberId}`, { method: "DELETE" });
}

export async function issueAccessCode(
  memberId: string,
): Promise<{ code: string; email: string; expiresInMin: number }> {
  return req(`/workspaces/${ws()}/members/${memberId}/access-code`, { method: "POST" });
}

/**
 * POST /workspaces/:wid/join-codes — el dueño/encargado genera un código de la
 * tienda. Cualquiera logueado que lo canjee (redeemJoinCode) entra como empleado
 * con ese rol, sin pre-cargar su email. Genera revoca el código anterior.
 */
export async function createJoinCode(
  role: "admin" | "vendedor" | "viewer" = "vendedor",
  expiresInDays = 7,
): Promise<{ code: string; role: string; expiresAt: string }> {
  return req(`/workspaces/${ws()}/join-codes`, {
    method: "POST",
    body: JSON.stringify({ role, expiresInDays }),
  });
}

/**
 * POST /join — canjear un código de tienda. NO usa ws(): el código define a qué
 * tienda entrás. Devuelve el workspace al que te uniste. ApiError posibles:
 * invalid_code / expired / seat_limit. `already` = ya eras miembro.
 */
export async function redeemJoinCode(
  code: string,
): Promise<{ workspaceId: string; workspaceName: string; role: string; already?: boolean }> {
  return req(`/join`, { method: "POST", body: JSON.stringify({ code }) });
}

/** GET /workspaces/:wid/join-codes — código de tienda activo, o null si no hay. */
export async function getActiveJoinCode(): Promise<
  { code: string; role: string; expiresAt: string; uses: number; createdAt: string | null } | null
> {
  const r = await req<{ code: string | null; role?: string; expiresAt?: string; uses?: number; createdAt?: string | null }>(
    `/workspaces/${ws()}/join-codes`,
  );
  if (!r || !r.code) return null;
  return {
    code: r.code,
    role: r.role ?? "vendedor",
    expiresAt: r.expiresAt ?? "",
    uses: r.uses ?? 0,
    createdAt: r.createdAt ?? null,
  };
}

/** DELETE /workspaces/:wid/join-codes — revoca el código de tienda activo. */
export async function revokeJoinCode(): Promise<void> {
  await req(`/workspaces/${ws()}/join-codes`, { method: "DELETE" });
}

/* ---------- catalog / inventory (CRUD simple; IMEIs diferidos) ---------- */
interface ProductRaw {
  id: string;
  name: string;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  cost?: number | null;
  sku?: string | null;
  notes?: string | null;
  track_stock?: number | null;
  stock?: number | null;
  stock_min?: number | null;
  active?: number | null;
  image_path?: string | null;
  condition?: string | null;
  created_at?: string | null;
}
function mapProduct(r: ProductRaw): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? undefined,
    price: Number(r.price ?? 0),
    currency: r.currency === "USD" ? "USD" : "ARS",
    cost: r.cost != null ? Number(r.cost) : undefined,
    sku: r.sku ?? undefined,
    notes: r.notes ?? undefined,
    trackStock: r.track_stock === 1,
    stock: Number(r.stock ?? 0),
    stockMin: r.stock_min != null ? Number(r.stock_min) : undefined,
    active: r.active !== 0,
    imagePath: r.image_path ?? undefined,
    condition: r.condition ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

export interface ProductInput {
  name?: string;
  category?: string | null;
  price?: number;
  cost?: number | null;
  currency?: Currency;
  sku?: string | null;
  notes?: string | null;
  trackStock?: boolean;
  stock?: number;
  stockMin?: number | null;
  active?: boolean;
  condition?: string | null;
  imagePath?: string | null;
}
function productBody(p: ProductInput): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  if (p.name !== undefined) b.name = p.name;
  if (p.category !== undefined) b.category = p.category;
  if (p.price !== undefined) b.price = p.price;
  if (p.cost !== undefined) b.cost = p.cost;
  if (p.currency !== undefined) b.currency = p.currency;
  if (p.sku !== undefined) b.sku = p.sku;
  if (p.notes !== undefined) b.notes = p.notes;
  if (p.trackStock !== undefined) b.track_stock = p.trackStock ? 1 : 0;
  if (p.stock !== undefined) b.stock = p.stock;
  if (p.stockMin !== undefined) b.stock_min = p.stockMin;
  if (p.active !== undefined) b.active = p.active ? 1 : 0;
  if (p.condition !== undefined) b.condition = p.condition;
  if (p.imagePath !== undefined) b.image_path = p.imagePath;
  return b;
}

export async function listCatalog(): Promise<Product[]> {
  const data = await req<{ items: ProductRaw[] }>(`/workspaces/${ws()}/catalog`);
  return (data.items ?? []).map(mapProduct);
}
export async function createProduct(input: ProductInput): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/catalog`, {
    method: "POST",
    body: JSON.stringify({ currency: "USD", ...productBody(input) }),
  });
  return r.id;
}

/** Importa varios productos de una (migración de catálogo). El Worker
 *  inserta con dedup por id e informa cuántos entraron / se omitieron. */
export async function bulkImportProducts(
  items: ProductInput[],
): Promise<{ imported: number; skipped: number; errors: Array<{ id: string; error: string }> }> {
  const body = { items: items.map((p) => ({ currency: "USD", ...productBody(p) })) };
  const r = await req<{ imported?: number; skipped?: number; errors?: Array<{ id: string; error: string }> }>(
    `/workspaces/${ws()}/catalog/import`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return { imported: r.imported ?? 0, skipped: r.skipped ?? 0, errors: r.errors ?? [] };
}
export async function updateProduct(id: string, patch: ProductInput): Promise<void> {
  await req(`/workspaces/${ws()}/catalog/${id}`, { method: "PATCH", body: JSON.stringify(productBody(patch)) });
}
export async function deleteProduct(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/catalog/${id}`, { method: "DELETE" });
}

/* ---------- IMEIs / N° de serie por producto (unidades serializadas) ----------
 * Cada unidad de un producto serializado (ej: iPhone) es única. El stock del
 * producto = cantidad de IMEIs sin vender. El Worker recalcula el stock al
 * agregar/borrar y marca `track_stock=1` automáticamente. */
export interface CatalogImei {
  id: string;
  imei: string;
  soldAt: string | null;
  saleId: string | null;
  createdAt: string | null;
}
interface CatalogImeiRaw {
  id: string;
  imei: string;
  sold_at?: string | null;
  sale_id?: string | null;
  created_at?: string | null;
}
function mapImei(r: CatalogImeiRaw): CatalogImei {
  return {
    id: r.id,
    imei: r.imei,
    soldAt: r.sold_at ?? null,
    saleId: r.sale_id ?? null,
    createdAt: r.created_at ?? null,
  };
}
export async function listCatalogImeis(itemId: string): Promise<CatalogImei[]> {
  const data = await req<{ imeis: CatalogImeiRaw[] }>(`/workspaces/${ws()}/catalog/${itemId}/imeis`);
  return (data.imeis ?? []).map(mapImei);
}
/** Agrega IMEIs (dedup contra los existentes en el server). Devuelve la lista
 *  completa actualizada + cuántos se agregaron / saltaron + el nuevo stock. */
export async function addCatalogImeis(
  itemId: string,
  imeis: string[],
): Promise<{ added: number; skipped: number; stock: number; imeis: CatalogImei[] }> {
  const r = await req<{ added?: number; skipped?: number; stock?: number; imeis?: CatalogImeiRaw[] }>(
    `/workspaces/${ws()}/catalog/${itemId}/imeis`,
    { method: "POST", body: JSON.stringify({ imeis }) },
  );
  return {
    added: Number(r.added ?? 0),
    skipped: Number(r.skipped ?? 0),
    stock: Number(r.stock ?? 0),
    imeis: (r.imeis ?? []).map(mapImei),
  };
}
/** Borra un IMEI. Tira ApiError "already_sold" (409) si la unidad ya se vendió. */
export async function deleteCatalogImei(itemId: string, imeiId: string): Promise<{ stock: number }> {
  const r = await req<{ stock?: number }>(`/workspaces/${ws()}/catalog/${itemId}/imeis/${imeiId}`, {
    method: "DELETE",
  });
  return { stock: Number(r.stock ?? 0) };
}

/* ---------- Refurbish interno: reparaciones / repuestos por unidad ----------
 * Cada reparación se SUMA al `cost` del producto (costo real del equipo), así
 * el margen de la venta y los reportes quedan bien sin tocar nada más. Las
 * funciones devuelven el nuevo `cost` total para sincronizar la UI. */
export interface CatalogRepair {
  id: string;
  description: string;
  cost: number;
  createdAt: string | null;
}
interface CatalogRepairRaw {
  id: string;
  description: string;
  cost?: number | null;
  created_at?: string | null;
}
function mapRepair(r: CatalogRepairRaw): CatalogRepair {
  return { id: r.id, description: r.description, cost: Number(r.cost ?? 0), createdAt: r.created_at ?? null };
}
export async function listCatalogRepairs(itemId: string): Promise<CatalogRepair[]> {
  const data = await req<{ repairs: CatalogRepairRaw[] }>(`/workspaces/${ws()}/catalog/${itemId}/repairs`);
  return (data.repairs ?? []).map(mapRepair);
}
export async function addCatalogRepair(
  itemId: string,
  input: { description: string; cost: number },
): Promise<{ cost: number; repair: CatalogRepair }> {
  const r = await req<{ cost?: number; repair?: CatalogRepairRaw }>(
    `/workspaces/${ws()}/catalog/${itemId}/repairs`,
    { method: "POST", body: JSON.stringify({ description: input.description, cost: input.cost }) },
  );
  return {
    cost: Number(r.cost ?? 0),
    repair: r.repair ? mapRepair(r.repair) : { id: "", description: input.description, cost: input.cost, createdAt: null },
  };
}
export async function deleteCatalogRepair(itemId: string, repairId: string): Promise<{ cost: number }> {
  const r = await req<{ cost?: number }>(`/workspaces/${ws()}/catalog/${itemId}/repairs/${repairId}`, {
    method: "DELETE",
  });
  return { cost: Number(r.cost ?? 0) };
}

/* ---------- workspace settings ---------- */
export async function updateWorkspace(patch: {
  name?: string;
  industry?: string;
  icon?: string | null;
  dailyGoal?: number;
  dailyGoalCurrency?: string;
  dailyGoalCount?: number;
  address?: string | null;
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.industry !== undefined) body.industry = patch.industry;
  if (patch.icon !== undefined) body.icon = patch.icon;
  if (patch.dailyGoal !== undefined) body.daily_goal = patch.dailyGoal;
  if (patch.dailyGoalCurrency !== undefined) body.daily_goal_currency = patch.dailyGoalCurrency;
  if (patch.dailyGoalCount !== undefined) body.daily_goal_count = patch.dailyGoalCount;
  if (patch.address !== undefined) body.address = patch.address;
  await req(`/workspaces/${ws()}`, { method: "PATCH", body: JSON.stringify(body) });
}

/* ---------- turno: PATCH venta (appointment + origin) ---------- */
export async function updateSale(
  id: string,
  patch: { appointmentAt?: string | null; origin?: string | null },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.appointmentAt !== undefined) body.appointment_at = patch.appointmentAt;
  if (patch.origin !== undefined) body.origin = patch.origin;
  await req(`/workspaces/${ws()}/sales/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

/* ---------- origins ("viene de") ---------- */
export async function listOrigins(): Promise<Origin[]> {
  const r = await req<{ origins: Array<{ id: string; name: string }> }>(`/workspaces/${ws()}/origins`);
  return (r.origins ?? []).map((o) => ({ id: o.id, name: o.name }));
}
export async function createOrigin(name: string): Promise<Origin> {
  const r = await req<{ origin: { id: string; name: string } }>(`/workspaces/${ws()}/origins`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return { id: r.origin.id, name: r.origin.name };
}
export async function deleteOrigin(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/origins/${id}`, { method: "DELETE" });
}

/* ---------- turnos (appointments) — Fase ④ ---------- */
interface AppointmentRaw {
  id: string;
  sale_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  appointment_at: string;
  type?: string | null;
  origin?: string | null;
  product?: string | null;
  notes?: string | null;
  status?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  day_seq?: number | null;
  created_at?: string | null;
}
function mapAppointment(r: AppointmentRaw): Appointment {
  return {
    id: r.id,
    saleId: r.sale_id ?? null,
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    customerPhone: r.customer_phone ?? null,
    appointmentAt: r.appointment_at,
    type: r.type ?? null,
    origin: r.origin ?? null,
    product: r.product ?? null,
    notes: r.notes ?? null,
    status: (r.status as Appointment["status"]) ?? "pending",
    ownerId: r.owner_id ?? null,
    ownerName: r.owner_name ?? null,
    daySeq: r.day_seq ?? null,
    createdAt: r.created_at ?? null,
  };
}
export interface AppointmentInput {
  saleId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  appointmentAt: string;
  type?: string | null;
  origin?: string | null;
  product?: string | null;
  notes?: string | null;
  status?: Appointment["status"];
  ownerName?: string | null;
}
function appointmentBody(input: Partial<AppointmentInput>): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  if (input.saleId !== undefined) b.sale_id = input.saleId;
  if (input.customerId !== undefined) b.customer_id = input.customerId;
  if (input.customerName !== undefined) b.customer_name = input.customerName;
  if (input.customerPhone !== undefined) b.customer_phone = input.customerPhone;
  if (input.appointmentAt !== undefined) b.appointment_at = input.appointmentAt;
  if (input.type !== undefined) b.type = input.type;
  if (input.origin !== undefined) b.origin = input.origin;
  if (input.product !== undefined) b.product = input.product;
  if (input.notes !== undefined) b.notes = input.notes;
  if (input.status !== undefined) b.status = input.status;
  if (input.ownerName !== undefined) b.owner_name = input.ownerName;
  return b;
}
export async function listAppointments(): Promise<Appointment[]> {
  const r = await req<{ appointments: AppointmentRaw[] }>(`/workspaces/${ws()}/appointments`);
  return (r.appointments ?? []).map(mapAppointment);
}
export async function createAppointment(input: AppointmentInput): Promise<{ id: string; daySeq: number | null }> {
  const r = await req<{ id: string; day_seq?: number | null }>(`/workspaces/${ws()}/appointments`, { method: "POST", body: JSON.stringify(appointmentBody(input)) });
  return { id: r.id, daySeq: r.day_seq ?? null };
}
export async function updateAppointment(id: string, patch: Partial<AppointmentInput>): Promise<void> {
  await req(`/workspaces/${ws()}/appointments/${id}`, { method: "PATCH", body: JSON.stringify(appointmentBody(patch)) });
}
export async function deleteAppointment(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/appointments/${id}`, { method: "DELETE" });
}

/* ---------- tipos de turno (editables) — Fase ④ ---------- */
export async function listAppointmentTypes(): Promise<AppointmentType[]> {
  const r = await req<{ types: Array<{ id: string; name: string }> }>(`/workspaces/${ws()}/appointment-types`);
  return (r.types ?? []).map((t) => ({ id: t.id, name: t.name }));
}
export async function createAppointmentType(name: string): Promise<AppointmentType> {
  const r = await req<{ type: { id: string; name: string } }>(`/workspaces/${ws()}/appointment-types`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return { id: r.type.id, name: r.type.name };
}
export async function deleteAppointmentType(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/appointment-types/${id}`, { method: "DELETE" });
}

/* ---------- reparaciones (taller) — Fase ⑥ ---------- */
interface RepairRaw {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_model?: string | null;
  device_imei?: string | null;
  device_passcode?: string | null;
  accessories?: string | null;
  problem?: string | null;
  diagnosis?: string | null;
  status?: string | null;
  parts_cost?: number | null;
  labor_cost?: number | null;
  deposit?: number | null;
  order_seq?: number | null;
  technician?: string | null;
  warranty_months?: number | null;
  notes?: string | null;
  received_at?: string | null;
  estimated_at?: string | null;
  delivered_at?: string | null;
  appointment_id?: string | null;
  sale_id?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
}
function mapRepairRow(r: RepairRaw): Repair {
  return {
    id: r.id,
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    customerPhone: r.customer_phone ?? null,
    deviceModel: r.device_model ?? null,
    deviceImei: r.device_imei ?? null,
    devicePasscode: r.device_passcode ?? null,
    accessories: r.accessories ?? null,
    problem: r.problem ?? null,
    diagnosis: r.diagnosis ?? null,
    status: (r.status as RepairStatus) ?? "received",
    partsCost: r.parts_cost ?? null,
    laborCost: r.labor_cost ?? null,
    deposit: r.deposit ?? null,
    orderSeq: r.order_seq ?? null,
    technician: r.technician ?? null,
    warrantyMonths: r.warranty_months ?? null,
    notes: r.notes ?? null,
    receivedAt: r.received_at ?? null,
    estimatedAt: r.estimated_at ?? null,
    deliveredAt: r.delivered_at ?? null,
    appointmentId: r.appointment_id ?? null,
    saleId: r.sale_id ?? null,
    ownerId: r.owner_id ?? null,
    ownerName: r.owner_name ?? null,
    createdAt: r.created_at ?? null,
  };
}
export interface RepairInput {
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deviceModel?: string | null;
  deviceImei?: string | null;
  devicePasscode?: string | null;
  accessories?: string | null;
  problem?: string | null;
  diagnosis?: string | null;
  status?: RepairStatus;
  partsCost?: number | null;
  laborCost?: number | null;
  deposit?: number | null;
  technician?: string | null;
  warrantyMonths?: number | null;
  notes?: string | null;
  estimatedAt?: string | null;
  deliveredAt?: string | null;
  appointmentId?: string | null;
  saleId?: string | null;
}
function repairBody(input: Partial<RepairInput>): Record<string, unknown> {
  const m: Record<string, string> = {
    customerId: "customer_id", customerName: "customer_name", customerPhone: "customer_phone",
    deviceModel: "device_model", deviceImei: "device_imei", devicePasscode: "device_passcode",
    accessories: "accessories", problem: "problem", diagnosis: "diagnosis", status: "status",
    partsCost: "parts_cost", laborCost: "labor_cost", deposit: "deposit", technician: "technician",
    warrantyMonths: "warranty_months", notes: "notes", estimatedAt: "estimated_at",
    deliveredAt: "delivered_at", appointmentId: "appointment_id", saleId: "sale_id",
  };
  const b: Record<string, unknown> = {};
  for (const [k, snake] of Object.entries(m)) {
    const v = (input as Record<string, unknown>)[k];
    if (v !== undefined) b[snake] = v;
  }
  return b;
}
export async function listRepairs(): Promise<Repair[]> {
  const r = await req<{ repairs: RepairRaw[] }>(`/workspaces/${ws()}/repairs`);
  return (r.repairs ?? []).map(mapRepairRow);
}
export async function createRepair(input: RepairInput): Promise<{ id: string }> {
  return req<{ id: string }>(`/workspaces/${ws()}/repairs`, { method: "POST", body: JSON.stringify(repairBody(input)) });
}
export async function updateRepair(id: string, patch: Partial<RepairInput>): Promise<void> {
  await req(`/workspaces/${ws()}/repairs/${id}`, { method: "PATCH", body: JSON.stringify(repairBody(patch)) });
}
export async function deleteRepair(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/repairs/${id}`, { method: "DELETE" });
}

/* repuestos itemizados de una reparación (descuentan stock del catálogo) */
export interface RepairPart {
  id: string;
  catalogItemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}
interface RepairPartRaw {
  id: string;
  catalog_item_id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
}
function mapRepairPart(r: RepairPartRaw): RepairPart {
  return {
    id: r.id,
    catalogItemId: r.catalog_item_id ?? null,
    description: r.description ?? "",
    quantity: Number(r.quantity ?? 1),
    unitPrice: Number(r.unit_price ?? 0),
    subtotal: Number(r.subtotal ?? 0),
  };
}
export async function listRepairParts(repairId: string): Promise<RepairPart[]> {
  const r = await req<{ parts: RepairPartRaw[] }>(`/workspaces/${ws()}/repairs/${repairId}/parts`);
  return (r.parts ?? []).map(mapRepairPart);
}
export async function addRepairPart(
  repairId: string,
  input: { catalogItemId?: string | null; description: string; quantity: number; unitPrice: number },
): Promise<{ partsCost: number }> {
  const r = await req<{ parts_cost?: number }>(`/workspaces/${ws()}/repairs/${repairId}/parts`, {
    method: "POST",
    body: JSON.stringify({
      catalog_item_id: input.catalogItemId ?? null,
      description: input.description,
      quantity: input.quantity,
      unit_price: input.unitPrice,
    }),
  });
  return { partsCost: Number(r.parts_cost ?? 0) };
}
export async function removeRepairPart(repairId: string, partId: string): Promise<{ partsCost: number }> {
  const r = await req<{ parts_cost?: number }>(`/workspaces/${ws()}/repairs/${repairId}/parts/${partId}`, { method: "DELETE" });
  return { partsCost: Number(r.parts_cost ?? 0) };
}

/* ---------- workspace settings (KV: plantillas, etc) ---------- */
export async function getSettings(): Promise<Record<string, string>> {
  const r = await req<{ settings: Record<string, string> }>(`/workspaces/${ws()}/settings`);
  return r.settings ?? {};
}
export async function setSettings(patch: Record<string, string>): Promise<void> {
  await req(`/workspaces/${ws()}/settings`, { method: "PUT", body: JSON.stringify({ settings: patch }) });
}

/* ---------- permisos por rol (Fase ⑤) ---------- */
export async function getRolePermissions(): Promise<{ roles: Record<string, string[]>; all: string[] }> {
  return req(`/workspaces/${ws()}/role-permissions`);
}
export async function setRolePermissions(roles: Record<string, string[]>): Promise<void> {
  await req(`/workspaces/${ws()}/role-permissions`, { method: "PUT", body: JSON.stringify({ roles }) });
}

/* ---------- roles personalizados (Fase ⑤.B) ---------- */
export async function getCustomRoles(): Promise<{ roles: Array<{ id: string; name: string; permissions: string[] }>; all: string[] }> {
  return req(`/workspaces/${ws()}/custom-roles`);
}
export async function setCustomRoles(roles: Array<{ id: string; name: string; permissions: string[] }>): Promise<void> {
  await req(`/workspaces/${ws()}/custom-roles`, { method: "PUT", body: JSON.stringify({ roles }) });
}

/* ---------- home por rol configurable (Fase ⑧) ---------- */
export async function getHomeLayouts(): Promise<{ layouts: Record<string, string[]> }> {
  return req(`/workspaces/${ws()}/home-layouts`);
}
export async function setHomeLayouts(layouts: Record<string, string[]>): Promise<void> {
  await req(`/workspaces/${ws()}/home-layouts`, { method: "PUT", body: JSON.stringify({ layouts }) });
}

/* ---------- followups (seguimientos) + last contact (Mi Día) ---------- */
interface FollowupRaw {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  reason?: string | null;
  text?: string | null;
  due_at?: string | null;
  days_since_contact?: number | null;
  amount?: number | null;
  notes?: string | null;
  completed_at?: string | null;
}
function mapFollowup(r: FollowupRaw): Followup {
  return {
    id: r.id,
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    reason: r.reason ?? null,
    text: r.text ?? "",
    dueAt: toIsoUtc(r.due_at) || (r.due_at ?? ""),
    daysSinceContact: r.days_since_contact != null ? Number(r.days_since_contact) : null,
    amount: r.amount != null ? Number(r.amount) : null,
    notes: r.notes ?? null,
    completedAt: r.completed_at ? toIsoUtc(r.completed_at) : null,
  };
}
export async function listFollowups(): Promise<Followup[]> {
  const data = await req<{ items: FollowupRaw[] }>(`/workspaces/${ws()}/followups`);
  return (data.items ?? []).map(mapFollowup);
}
export async function completeFollowup(id: string, completed: boolean): Promise<void> {
  await req(`/workspaces/${ws()}/followups/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed_at: completed ? new Date().toISOString() : null }),
  });
}
export async function deleteFollowup(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/followups/${id}`, { method: "DELETE" });
}

/** Registra un contacto con un cliente (WhatsApp/llamada/etc.) — actualiza su
 *  "último contacto" para el cálculo de inactivos. */
export async function recordContact(customerId: string, kind: string): Promise<void> {
  await req(`/workspaces/${ws()}/customers/${customerId}/contacts`, {
    method: "POST",
    body: JSON.stringify({ kind }),
  });
}

/** Mapa { customerId → fecha del último contacto (ISO-UTC) }. Un round-trip. */
export async function getLastContactByCustomer(): Promise<Record<string, string>> {
  const data = await req<{ lastByCustomer: Record<string, string> }>(
    `/workspaces/${ws()}/customer-contacts/last-by-customer`,
  );
  const raw = data.lastByCustomer ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = toIsoUtc(v) || v;
  return out;
}

/* ---------- payment methods (config) ---------- */
interface PayMethodRaw {
  id: string;
  name: string;
  enabled?: number | null;
  currency?: string | null;
  sort_order?: number | null;
}
function mapPayMethod(r: PayMethodRaw): PaymentOption {
  return {
    id: r.id,
    name: r.name,
    enabled: r.enabled !== 0,
    currency: r.currency ?? undefined,
    sortOrder: r.sort_order ?? undefined,
  };
}
export async function listPaymentMethods(): Promise<PaymentOption[]> {
  const data = await req<{ items: PayMethodRaw[] }>(`/workspaces/${ws()}/payment-methods`);
  return (data.items ?? []).map(mapPayMethod);
}
export async function createPaymentMethod(name: string): Promise<void> {
  await req(`/workspaces/${ws()}/payment-methods`, { method: "POST", body: JSON.stringify({ name }) });
}
export async function deletePaymentMethod(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/payment-methods/${id}`, { method: "DELETE" });
}

/* ---------- customer types (config) ---------- */
interface CustomerTypeRaw {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number | null;
}
function mapCustomerType(r: CustomerTypeRaw): CustomerType {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    color: r.color ?? null,
    sortOrder: r.sort_order ?? null,
  };
}
export async function listCustomerTypes(): Promise<CustomerType[]> {
  const data = await req<{ items: CustomerTypeRaw[] }>(`/workspaces/${ws()}/customer-types`);
  return (data.items ?? []).map(mapCustomerType);
}
export async function createCustomerType(input: { name: string; color?: string | null; description?: string | null }): Promise<void> {
  await req(`/workspaces/${ws()}/customer-types`, {
    method: "POST",
    body: JSON.stringify({ name: input.name, color: input.color ?? null, description: input.description ?? null }),
  });
}
export async function updateCustomerType(id: string, patch: { name?: string; color?: string | null; description?: string | null }): Promise<void> {
  await req(`/workspaces/${ws()}/customer-types/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export async function deleteCustomerType(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/customer-types/${id}`, { method: "DELETE" });
}

/* ---------- customer tags (config) ---------- */
interface CustomerTagRaw {
  id: string;
  name: string;
  color?: string | null;
}
function mapCustomerTag(r: CustomerTagRaw): CustomerTag {
  return { id: r.id, name: r.name, color: r.color ?? null };
}
export async function listCustomerTags(): Promise<CustomerTag[]> {
  const data = await req<{ items: CustomerTagRaw[] }>(`/workspaces/${ws()}/customer-tags`);
  return (data.items ?? []).map(mapCustomerTag);
}
export async function createCustomerTag(input: { name: string; color?: string | null }): Promise<void> {
  await req(`/workspaces/${ws()}/customer-tags`, {
    method: "POST",
    body: JSON.stringify({ name: input.name, color: input.color ?? null }),
  });
}
export async function deleteCustomerTag(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/customer-tags/${id}`, { method: "DELETE" });
}

/* ---------- workspace logo/banner (R2) ---------- */
/** Sube el logo/banner del negocio. El worker recibe el binario crudo con el
 *  Content-Type de la imagen (no multipart). Devuelve la key + url relativas. */
async function uploadAsset(kind: "logo" | "banner", file: File): Promise<{ key: string; url: string }> {
  const token = getToken();
  const res = await fetch(`${WORKER_URL}/workspaces/${ws()}/${kind}`, {
    method: "POST",
    headers: {
      "content-type": file.type || "image/png",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, (body && body.error) || `http_${res.status}`);
  return { key: body.key, url: body.url };
}
export function uploadWorkspaceLogo(file: File) {
  return uploadAsset("logo", file);
}
export function uploadWorkspaceBanner(file: File) {
  return uploadAsset("banner", file);
}
export async function deleteWorkspaceLogo(): Promise<void> {
  await req(`/workspaces/${ws()}/logo`, { method: "DELETE" });
}
export async function deleteWorkspaceBanner(): Promise<void> {
  await req(`/workspaces/${ws()}/banner`, { method: "DELETE" });
}
/** URL absoluta para mostrar un asset (logo/banner) desde su key de R2. */
export function assetUrl(key: string): string {
  return `${WORKER_URL}/assets/${key}`;
}

/* ---------- cash movements (sesión abrir/cerrar diferida) ---------- */
interface CashMovementRaw {
  id: string;
  kind?: string | null;
  amount?: number | null;
  currency?: string | null;
  description?: string | null;
  category?: string | null;
  payment_method?: string | null;
  customer_name?: string | null;
  sale_id?: string | null;
  moved_at?: string | null;
  created_at?: string | null;
}
function mapCashMovement(r: CashMovementRaw): CashMovement {
  return {
    id: r.id,
    kind: r.kind === "expense" ? "expense" : "income",
    amount: Number(r.amount ?? 0),
    currency: r.currency === "USD" ? "USD" : "ARS",
    description: r.description ?? undefined,
    category: r.category ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    customerName: r.customer_name ?? undefined,
    saleId: r.sale_id ?? undefined,
    movedAt: toIsoUtc(r.moved_at ?? r.created_at) || undefined,
  };
}

export async function listCashMovements(): Promise<CashMovement[]> {
  const data = await req<{ items: CashMovementRaw[] }>(`/workspaces/${ws()}/cash`);
  return (data.items ?? []).map(mapCashMovement);
}
export async function createCashMovement(input: {
  kind: CashKind;
  amount: number;
  currency: Currency;
  description?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
}): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/cash`, {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      description: input.description ?? null,
      category: input.category ?? null,
      payment_method: input.paymentMethod ?? null,
      moved_at: new Date().toISOString(),
    }),
  });
  return r.id;
}
export async function deleteCashMovement(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/cash/${id}`, { method: "DELETE" });
}

/* ---------- cash sessions (apertura/cierre diario + arqueo) ---------- */
interface CashSessionRaw {
  id: string;
  session_date?: string | null;
  opened_at?: string | null;
  opened_balance_ars?: number | null;
  opened_balance_usd?: number | null;
  opened_buckets?: string | null;
  closed_at?: string | null;
  closed_balance_ars?: number | null;
  closed_balance_usd?: number | null;
  closed_buckets?: string | null;
}
/** Parsea el JSON de buckets del Worker ({ "Efectivo·ARS": 1000 }) de forma
 *  tolerante: descarta valores no numéricos y cualquier cosa que no sea objeto. */
function parseBuckets(s: string | null | undefined): CashBuckets | null {
  if (!s) return null;
  try {
    const o = JSON.parse(s) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out: CashBuckets = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
/** El Worker devuelve datetime('now') = "YYYY-MM-DD HH:MM:SS" (UTC, sin zona).
 *  Lo normalizamos a ISO-UTC para que new Date()/formatRelative lo interpreten
 *  como instante UTC y lo muestren en hora local correcta (sino se corre 3h). */
function toIsoUtc(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.includes("T") ? s : s.replace(" ", "T");
  return /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + "Z";
}
function mapCashSession(r: CashSessionRaw): CashSession {
  return {
    id: r.id,
    date: r.session_date ?? "",
    openedAt: toIsoUtc(r.opened_at),
    openedBalanceArs: Number(r.opened_balance_ars ?? 0),
    openedBalanceUsd: Number(r.opened_balance_usd ?? 0),
    openedBuckets: parseBuckets(r.opened_buckets),
    closedAt: r.closed_at ? toIsoUtc(r.closed_at) : null,
    closedBalanceArs: r.closed_balance_ars != null ? Number(r.closed_balance_ars) : null,
    closedBalanceUsd: r.closed_balance_usd != null ? Number(r.closed_balance_usd) : null,
    closedBuckets: parseBuckets(r.closed_buckets),
  };
}

export async function listCashSessions(): Promise<CashSession[]> {
  const data = await req<{ items: CashSessionRaw[] }>(`/workspaces/${ws()}/cash-sessions`);
  return (data.items ?? []).map(mapCashSession);
}
export async function openCashSession(input: {
  date: string;
  ars?: number;
  usd?: number;
  buckets?: CashBuckets;
}): Promise<CashSession> {
  const data = await req<{ session: CashSessionRaw }>(`/workspaces/${ws()}/cash-sessions/open`, {
    method: "POST",
    body: JSON.stringify({
      session_date: input.date,
      opened_balance_ars: input.ars ?? 0,
      opened_balance_usd: input.usd ?? 0,
      opened_buckets: input.buckets ?? null,
    }),
  });
  return mapCashSession(data.session);
}
export async function closeCashSession(
  sessionId: string,
  input: { ars: number; usd: number; buckets?: CashBuckets },
): Promise<CashSession> {
  const data = await req<{ session: CashSessionRaw }>(
    `/workspaces/${ws()}/cash-sessions/${sessionId}/close`,
    {
      method: "POST",
      body: JSON.stringify({
        closed_balance_ars: input.ars,
        closed_balance_usd: input.usd,
        closed_buckets: input.buckets ?? null,
      }),
    },
  );
  return mapCashSession(data.session);
}

/* ---------- Consola Clozr: códigos (super-admin) + canje (owner) ---------- */
export type ConsoleCodeKind = "license" | "discount" | "unlock";
export type DiscountType = "percent" | "amount";

export interface ConsoleCode {
  id: string;
  code: string;
  kind: ConsoleCodeKind;
  plan: string | null;
  durationDays: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  /** F4/F5: objetivo del código (ej "catalog:apple" para kind 'unlock'). */
  target: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  note: string | null;
  createdAt: string | null;
  disabledAt: string | null;
}
interface ConsoleCodeRaw {
  id: string;
  code: string;
  kind: string;
  plan?: string | null;
  duration_days?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  target?: string | null;
  max_uses?: number | null;
  uses?: number | null;
  expires_at?: string | null;
  note?: string | null;
  created_at?: string | null;
  disabled_at?: string | null;
}
function mapConsoleCode(r: ConsoleCodeRaw): ConsoleCode {
  return {
    id: r.id,
    code: r.code,
    kind: r.kind === "discount" ? "discount" : r.kind === "unlock" ? "unlock" : "license",
    plan: r.plan ?? null,
    target: r.target ?? null,
    durationDays: r.duration_days != null ? Number(r.duration_days) : null,
    discountType: (r.discount_type as DiscountType | null) ?? null,
    discountValue: r.discount_value != null ? Number(r.discount_value) : null,
    maxUses: r.max_uses != null ? Number(r.max_uses) : null,
    uses: Number(r.uses ?? 0),
    expiresAt: r.expires_at ?? null,
    note: r.note ?? null,
    createdAt: r.created_at ?? null,
    disabledAt: r.disabled_at ?? null,
  };
}

export async function listConsoleCodes(): Promise<ConsoleCode[]> {
  const data = await req<{ items: ConsoleCodeRaw[] }>("/console/codes");
  return (data.items ?? []).map(mapConsoleCode);
}

export interface NewConsoleCodeInput {
  kind: ConsoleCodeKind;
  plan?: "pro" | "team";
  durationDays?: number | null;
  discountType?: DiscountType;
  discountValue?: number;
  /** Para kind 'unlock': "catalog:<key>". */
  target?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
  note?: string | null;
  /** Código custom opcional; si no se manda, el Worker genera uno. */
  code?: string;
}
export async function createConsoleCode(input: NewConsoleCodeInput): Promise<ConsoleCode> {
  const body: Record<string, unknown> = { kind: input.kind };
  if (input.plan !== undefined) body.plan = input.plan;
  if (input.durationDays != null) body.duration_days = input.durationDays;
  if (input.discountType !== undefined) body.discount_type = input.discountType;
  if (input.discountValue !== undefined) body.discount_value = input.discountValue;
  if (input.target !== undefined) body.target = input.target;
  if (input.maxUses != null) body.max_uses = input.maxUses;
  if (input.expiresAt) body.expires_at = input.expiresAt;
  if (input.note) body.note = input.note;
  if (input.code) body.code = input.code;
  const r = await req<{ code: ConsoleCodeRaw }>("/console/codes", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapConsoleCode(r.code);
}

export async function updateConsoleCode(
  id: string,
  patch: { disabled?: boolean; note?: string | null; maxUses?: number | null; expiresAt?: string | null },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.disabled !== undefined) body.disabled = patch.disabled;
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.maxUses !== undefined) body.max_uses = patch.maxUses;
  if (patch.expiresAt !== undefined) body.expires_at = patch.expiresAt;
  await req(`/console/codes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export interface RedeemResult {
  kind: ConsoleCodeKind;
  plan?: string;
  seats?: number;
  licenseExpiresAt?: string | null;
  discountType?: DiscountType;
  discountValue?: number;
  /** Para kind 'unlock'. */
  target?: string;
  catalog?: string;
}
/** Canje de un código en el workspace activo (lo pega el dueño). */
export async function redeemCode(code: string): Promise<RedeemResult> {
  const r = await req<{
    kind: string;
    plan?: string;
    seats?: number;
    license_expires_at?: string | null;
    discount_type?: string;
    discount_value?: number;
    target?: string;
    catalog?: string;
  }>(`/workspaces/${ws()}/redeem-code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return {
    kind: r.kind === "discount" ? "discount" : r.kind === "unlock" ? "unlock" : "license",
    plan: r.plan,
    seats: r.seats,
    licenseExpiresAt: r.license_expires_at ?? null,
    discountType: r.discount_type as DiscountType | undefined,
    discountValue: r.discount_value,
    target: r.target,
    catalog: r.catalog,
  };
}

/** POST /workspaces/:wid/catalog/checkout — pago único para desbloquear un
 *  catálogo premium. Devuelve el init_point de Mercado Pago. */
export async function catalogCheckout(catalog: string): Promise<{ initPoint: string }> {
  const r = await req<{ init_point: string }>(`/workspaces/${ws()}/catalog/checkout`, {
    method: "POST",
    body: JSON.stringify({ catalog }),
  });
  return { initPoint: r.init_point };
}

/* ---------- IA de Clozr (chat con microtransacciones) ---------- */
export interface AiWallet {
  credits: number;
  freeUsed: number;
  freeLimit: number;
}
export interface AiStatus extends AiWallet {
  enabled: boolean;
}
export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function aiStatus(): Promise<AiStatus> {
  const r = await req<Partial<AiStatus>>(`/workspaces/${ws()}/ai`);
  return {
    credits: r.credits ?? 0,
    freeUsed: r.freeUsed ?? 0,
    freeLimit: r.freeLimit ?? 1,
    enabled: r.enabled ?? false,
  };
}

/** Manda la conversación y devuelve la respuesta + la billetera actualizada.
 *  Si no quedan mensajes, el Worker responde 402 y `req` lanza ApiError("no_credits"). */
export async function aiChat(messages: AiChatMessage[]): Promise<{ reply: string; wallet: AiWallet }> {
  const r = await req<{ reply: string; wallet: AiWallet }>(`/workspaces/${ws()}/ai/chat`, {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
  return r;
}

export interface AiActionParams {
  action: "generate" | "rewrite" | "summary" | "daybrief";
  kind?: string; // para generate
  tone?: string; // para rewrite
  text?: string; // para rewrite
  context?: Record<string, unknown>; // datos del cliente (generate / summary)
}

/** Acción contextual (Pro AI): generar o reescribir. Devuelve el texto + saldo.
 *  Sin saldo → el Worker responde 402 y `req` lanza ApiError("no_credits"). */
export async function aiAction(params: AiActionParams): Promise<{ text: string; wallet: AiWallet }> {
  return req<{ text: string; wallet: AiWallet }>(`/workspaces/${ws()}/ai/action`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function aiCheckout(pack: string): Promise<{ initPoint: string }> {
  const r = await req<{ init_point: string }>(`/workspaces/${ws()}/ai/checkout`, {
    method: "POST",
    body: JSON.stringify({ pack }),
  });
  return { initPoint: r.init_point };
}

/** POST /workspaces/:wid/referral — código de referido del workspace (se crea
 *  si no existe). Al canjearlo, referido y referidor reciben el descuento. */
export async function getReferralCode(): Promise<{ code: string; discountPct: number }> {
  const r = await req<{ code: string; discount_pct?: number }>(`/workspaces/${ws()}/referral`, {
    method: "POST",
  });
  return { code: r.code, discountPct: Number(r.discount_pct ?? 0) };
}

/** POST /workspaces/:wid/cover — suma un espacio/sucursal (del mismo dueño) al
 *  plan del workspace activo (el que paga). El espacio cubierto copia el plan y
 *  no paga aparte; la suscripción del principal sube ESPACIO_USD/mes. Puede tirar
 *  ApiError "needs_recheckout" si MP no permite el cambio de monto. */
export async function coverWorkspace(targetWorkspaceId: string): Promise<{ covered: number; plan: string }> {
  const r = await req<{ covered?: number; plan?: string }>(`/workspaces/${ws()}/cover`, {
    method: "POST",
    body: JSON.stringify({ target_workspace_id: targetWorkspaceId }),
  });
  return { covered: Number(r.covered ?? 0), plan: r.plan ?? "free" };
}

/** POST /workspaces/:wid/uncover — quita un espacio cubierto (vuelve a Free) y
 *  baja el monto del plan del workspace activo. */
export async function uncoverWorkspace(targetWorkspaceId: string): Promise<void> {
  await req(`/workspaces/${ws()}/uncover`, {
    method: "POST",
    body: JSON.stringify({ target_workspace_id: targetWorkspaceId }),
  });
}

/* ---------- Consola: panel de cuentas (workspaces) ---------- */
export interface ConsoleWorkspace {
  id: string;
  name: string;
  plan: string;
  seats: number;
  planStatus: string;
  createdAt: string | null;
  /** Vencimiento de licencia gratis (Consola). null = sin licencia. */
  licenseExpiresAt: string | null;
  /** Id de suscripción Mercado Pago. Si está, es pago real (no licencia). */
  mpPreapprovalId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  memberCount: number;
}
interface ConsoleWorkspaceRaw {
  id: string;
  name: string;
  plan?: string | null;
  seats?: number | null;
  plan_status?: string | null;
  created_at?: string | null;
  license_expires_at?: string | null;
  mp_preapproval_id?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  member_count?: number | null;
}
export interface ConsoleWorkspacesResult {
  items: ConsoleWorkspace[];
  totalUsers: number;
}
export async function listConsoleWorkspaces(): Promise<ConsoleWorkspacesResult> {
  const data = await req<{ items: ConsoleWorkspaceRaw[]; total_users?: number }>("/console/workspaces");
  return {
    totalUsers: Number(data.total_users ?? 0),
    items: (data.items ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      plan: r.plan ?? "free",
      seats: Number(r.seats ?? 1),
      planStatus: r.plan_status ?? "active",
      createdAt: r.created_at ?? null,
      licenseExpiresAt: r.license_expires_at ?? null,
      mpPreapprovalId: r.mp_preapproval_id ?? null,
      ownerEmail: r.owner_email ?? null,
      ownerName: r.owner_name ?? null,
      memberCount: Number(r.member_count ?? 0),
    })),
  };
}
