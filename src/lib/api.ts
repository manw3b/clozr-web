/**
 * Cliente HTTP de Clozr Web → cf-worker (API REST CRUD multi-tenant en prod).
 *
 * Equivalente web de la capa `lib/db/` del desktop: funciones de dominio,
 * pero haciendo fetch al Worker. El JWT viaja en `Authorization: Bearer`.
 * El mapeo snake_case (DB/Worker) ↔ camelCase (UI) se hace acá.
 */
import type {
  Currency,
  CashKind,
  CashMovement,
  CashSession,
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
  workspaces: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    daily_goal?: number | null;
    daily_goal_currency?: string | null;
    daily_goal_count?: number | null;
  }>;
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
      dailyGoal: Number(w.daily_goal ?? 0),
      dailyGoalCurrency: w.daily_goal_currency ?? "ARS",
      dailyGoalCount: Number(w.daily_goal_count ?? 0),
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
  items: Array<{ description: string; quantity: number; unitPrice: number; catalogItemId?: string | null }>;
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
    catalog_item_id: i.catalogItemId ?? null,
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

/* ---------- sale items (bulk, para Reportes v2) ---------- */
interface SaleItemReportRaw {
  id: string;
  sale_id: string;
  catalog_item_id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
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
    saleDate: toIsoUtc(r.sale_date ?? r.sale_created_at) || null,
    sellerName: r.seller_name ?? null,
  };
}
export async function listSaleItems(): Promise<SaleItemReport[]> {
  const data = await req<{ items: SaleItemReportRaw[] }>(`/workspaces/${ws()}/sale-items`);
  return (data.items ?? []).map(mapSaleItemReport);
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
}): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/tasks`, {
    method: "POST",
    body: JSON.stringify({ title: input.title, type: input.type, due_at: input.dueAt ?? null }),
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
  };
}

export async function listMembers(): Promise<Member[]> {
  const data = await req<{ members: MemberRaw[] }>(`/workspaces/${ws()}/members`);
  return (data.members ?? []).map(mapMember);
}

export async function inviteMember(email: string, role: "admin" | "vendedor" | "viewer"): Promise<void> {
  await req(`/workspaces/${ws()}/invite`, { method: "POST", body: JSON.stringify({ email, role }) });
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
  sku?: string | null;
  notes?: string | null;
  trackStock?: boolean;
  stock?: number;
  stockMin?: number | null;
  active?: boolean;
  condition?: string | null;
}
function productBody(p: ProductInput): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  if (p.name !== undefined) b.name = p.name;
  if (p.category !== undefined) b.category = p.category;
  if (p.price !== undefined) b.price = p.price;
  if (p.cost !== undefined) b.cost = p.cost;
  if (p.sku !== undefined) b.sku = p.sku;
  if (p.notes !== undefined) b.notes = p.notes;
  if (p.trackStock !== undefined) b.track_stock = p.trackStock ? 1 : 0;
  if (p.stock !== undefined) b.stock = p.stock;
  if (p.stockMin !== undefined) b.stock_min = p.stockMin;
  if (p.active !== undefined) b.active = p.active ? 1 : 0;
  if (p.condition !== undefined) b.condition = p.condition;
  return b;
}

export async function listCatalog(): Promise<Product[]> {
  const data = await req<{ items: ProductRaw[] }>(`/workspaces/${ws()}/catalog`);
  return (data.items ?? []).map(mapProduct);
}
export async function createProduct(input: ProductInput): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/catalog`, {
    method: "POST",
    body: JSON.stringify({ currency: "ARS", ...productBody(input) }),
  });
  return r.id;
}
export async function updateProduct(id: string, patch: ProductInput): Promise<void> {
  await req(`/workspaces/${ws()}/catalog/${id}`, { method: "PATCH", body: JSON.stringify(productBody(patch)) });
}
export async function deleteProduct(id: string): Promise<void> {
  await req(`/workspaces/${ws()}/catalog/${id}`, { method: "DELETE" });
}

/* ---------- workspace settings ---------- */
export async function updateWorkspace(patch: {
  name?: string;
  industry?: string;
  dailyGoal?: number;
  dailyGoalCurrency?: string;
  dailyGoalCount?: number;
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.industry !== undefined) body.industry = patch.industry;
  if (patch.dailyGoal !== undefined) body.daily_goal = patch.dailyGoal;
  if (patch.dailyGoalCurrency !== undefined) body.daily_goal_currency = patch.dailyGoalCurrency;
  if (patch.dailyGoalCount !== undefined) body.daily_goal_count = patch.dailyGoalCount;
  await req(`/workspaces/${ws()}`, { method: "PATCH", body: JSON.stringify(body) });
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
}): Promise<string> {
  const r = await req<{ id: string }>(`/workspaces/${ws()}/cash`, {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      description: input.description ?? null,
      category: input.category ?? null,
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
  closed_at?: string | null;
  closed_balance_ars?: number | null;
  closed_balance_usd?: number | null;
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
    closedAt: r.closed_at ? toIsoUtc(r.closed_at) : null,
    closedBalanceArs: r.closed_balance_ars != null ? Number(r.closed_balance_ars) : null,
    closedBalanceUsd: r.closed_balance_usd != null ? Number(r.closed_balance_usd) : null,
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
}): Promise<CashSession> {
  const data = await req<{ session: CashSessionRaw }>(`/workspaces/${ws()}/cash-sessions/open`, {
    method: "POST",
    body: JSON.stringify({
      session_date: input.date,
      opened_balance_ars: input.ars ?? 0,
      opened_balance_usd: input.usd ?? 0,
    }),
  });
  return mapCashSession(data.session);
}
export async function closeCashSession(
  sessionId: string,
  input: { ars: number; usd: number },
): Promise<CashSession> {
  const data = await req<{ session: CashSessionRaw }>(
    `/workspaces/${ws()}/cash-sessions/${sessionId}/close`,
    {
      method: "POST",
      body: JSON.stringify({
        closed_balance_ars: input.ars,
        closed_balance_usd: input.usd,
      }),
    },
  );
  return mapCashSession(data.session);
}
