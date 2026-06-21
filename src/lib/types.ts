/**
 * Tipos de dominio de Clozr Web (camelCase para la UI).
 * El mapeo desde/hacia el shape snake_case del Worker vive en lib/api.ts.
 */

export type ClientType = "final" | "revendedor" | "mayorista" | "empresa";
export type LeadPriority = "low" | "medium" | "high" | "hot";
export type LeadSource = "referido" | "walk-in" | "web" | "redes" | "otro";
export type Currency = "ARS" | "USD";
export type TaskType = "puntual" | "rutina";

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  /** Consola Clozr: super-admin de la plataforma (gate por email en el Worker). */
  isSuperAdmin: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  status: string;
  /** F3: rubro del negocio (key de INDUSTRY_TEMPLATES, o texto libre si "Otro"). */
  industry?: string;
  /** F3: emoji/miniatura del espacio (fallback cuando no hay logo). */
  icon?: string | null;
  /** F4: catálogos premium desbloqueados (keys, ej ["apple"]). */
  unlockedCatalogs?: string[];
  /** F5: descuento activo del workspace (otorgado por código), o null. */
  discount?: { type: string; value: number; target: string } | null;
  /** Crecimiento: intervalo de cobro de la suscripción ('monthly' | 'annual'). */
  billingInterval?: string;
  /** Objetivo diario (monto). 0 / undefined = sin objetivo seteado. */
  dailyGoal?: number;
  dailyGoalCurrency?: string;
  /** Objetivo de cantidad de ventas del día. */
  dailyGoalCount?: number;
  /** Keys de R2 (relativas) del logo/banner del negocio. El cliente arma /assets/{key}. */
  logoKey?: string | null;
  bannerKey?: string | null;
  /** Plan de suscripción del workspace (billing T3): 'free' | 'pro' | 'team'. */
  plan?: string;
  /** Asientos permitidos por el plan (free=1, pro=3, team=9999 ≈ ilimitado). */
  seats?: number;
  /** Estado de la suscripción: 'active' | 'trialing' | 'past_due' | 'cancelled'. */
  planStatus?: string;
  /** Crecimiento: si este espacio está cubierto por el plan de otro, su id. null = independiente. */
  coveredBy?: string | null;
}

/* ───────── Planes / billing (T3) ─────────
 * Espejo del PLAN_CONFIG del worker (cf-worker/src/routes/billing.ts):
 * Free = 1 asiento (gratis); Pro = ARS 25.000/mes · 3 asientos; Team =
 * ARS 60.000/mes · asientos ilimitados. Los pagos tienen 14 días de prueba. */
export type PlanId = "free" | "pro" | "team";

export interface PlanInfo {
  id: PlanId;
  name: string;
  /** Precio mensual en USD (fuente de verdad). 0 = gratis. Se cobra en ARS
   *  al dólar blue del momento. */
  priceUsd: number;
  /** Empleados incluidos (base). Se pueden sumar más a EXTRA_SEAT_USD c/u. */
  seats: number;
  tagline: string;
  features: string[];
}

/** seats === este valor ⇒ "ilimitado" (legacy; hoy ningún plan lo usa). */
export const SEATS_UNLIMITED = 9999;
/** Días de prueba de los planes pagos. */
export const BILLING_TRIAL_DAYS = 14;
/** Precio mensual (USD) de cada empleado extra, más allá de los del plan. */
export const EXTRA_SEAT_USD = 5;
/** Precio mensual (USD) de cada espacio/sucursal adicional sumado al plan. */
export const ESPACIO_USD = 10;
/** Cobro anual = pagás 10 meses, tenés 12 (2 gratis). */
export const ANNUAL_MONTHS_PAID = 10;
export const ANNUAL_MONTHS_FREE = 2;

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    seats: 1,
    tagline: "Para arrancar solo.",
    features: ["1 empleado", "Clientes, pipeline y ventas", "Caja básica"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 20,
    seats: 2,
    tagline: "Tu negocio, casi todo incluido.",
    features: [
      "2 empleados incluidos",
      "Roles y permisos por miembro",
      "Inventario, deudas y tareas",
      "Reportes del negocio",
      "Multi-moneda + WhatsApp",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceUsd: 45,
    seats: 5,
    tagline: "Para escalar con tu equipo.",
    features: [
      "5 empleados incluidos",
      "Todo lo de Pro",
      "Clozr de noche (IA)",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
  },
};

/** Planes pagos, en orden de precio (para upsell). */
export const PAID_PLAN_IDS: Array<Exclude<PlanId, "free">> = ["pro", "team"];

/** Formatea un monto en ARS para mostrar (sin decimales). */
export function formatArs(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

/** Formatea un precio en USD para mostrar. */
export function formatUsd(n: number): string {
  return `USD ${n.toLocaleString("en-US")}`;
}

/* ───────── Catálogos premium (add-on de pago único, F4) ───────── */
export interface CatalogPack {
  key: string;
  label: string;
  /** Precio del desbloqueo, una sola vez. */
  priceUsd: number;
  description: string;
}
export const CATALOG_PACKS: Record<string, CatalogPack> = {
  apple: {
    key: "apple",
    label: "Catálogo Apple",
    priceUsd: 100,
    description: "iPhone, iPad, Mac, Watch y AirPods con imágenes, colores y capacidades — listos para cargar.",
  },
};

/* ───────── Descuentos apuntados (F5) ───────── */
/** A qué puede apuntar un código de descuento (Consola). */
export const DISCOUNT_TARGETS: Array<{ key: string; label: string }> = [
  { key: "all", label: "Todo" },
  { key: "plan:any", label: "Cualquier plan" },
  { key: "plan:pro", label: "Plan Pro" },
  { key: "plan:team", label: "Plan Team" },
  { key: "catalog:any", label: "Cualquier catálogo" },
  { key: "catalog:apple", label: "Catálogo Apple" },
];

/** Etiqueta legible de un target de descuento. */
export function discountTargetLabel(target: string | null | undefined): string {
  if (!target) return "—";
  return DISCOUNT_TARGETS.find((t) => t.key === target)?.label ?? target;
}

/** Tipo de cliente configurable (customer_types). */
export interface CustomerType {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number | null;
}

/** Etiqueta de cliente (customer_tags). */
export interface CustomerTag {
  id: string;
  name: string;
  color?: string | null;
}

/** Seguimiento pendiente (tabla followups). */
export interface Followup {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  reason?: string | null;
  text: string;
  dueAt: string;
  daysSinceContact?: number | null;
  amount?: number | null;
  notes?: string | null;
  completedAt?: string | null;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  notes?: string | null;
  dueAt?: string | null;
  completed: boolean;
  /** Si viene de un template (ej. 'ai-triage' = sugerida por la IA matutina). */
  templateId?: string | null;
  customerId?: string | null;
  createdAt?: string | null;
}

export interface Member {
  id: string;
  userId?: string | null;
  email: string;
  role: string;
  status: string;
  userName?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  category?: string | null;
  price: number;
  currency: Currency;
  cost?: number | null;
  sku?: string | null;
  notes?: string | null;
  trackStock: boolean;
  stock: number;
  stockMin?: number | null;
  active: boolean;
  imagePath?: string | null;
  condition?: string | null;
  createdAt?: string | null;
}

export interface PaymentOption {
  id: string;
  name: string;
  enabled: boolean;
  currency?: string | null;
  sortOrder?: number | null;
}

export type CashKind = "income" | "expense";
export interface CashMovement {
  id: string;
  kind: CashKind;
  amount: number;
  currency: Currency;
  description?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
  customerName?: string | null;
  saleId?: string | null;
  movedAt?: string | null;
}

/** Sesión de caja del día (apertura/cierre + arqueo). Una por día por workspace. */
export interface CashSession {
  id: string;
  date: string; // YYYY-MM-DD (session_date)
  openedAt: string;
  openedBalanceArs: number;
  openedBalanceUsd: number;
  closedAt?: string | null;
  closedBalanceArs?: number | null;
  closedBalanceUsd?: number | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  type: ClientType;
  notes?: string;
  createdAt?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineItem {
  id: string;
  customerId: string;
  customerName: string;
  stageId: string;
  stageName: string;
  stageOrder: number;
  amount?: number | null;
  currency: Currency;
  product?: string;
  priority: LeadPriority;
  source?: LeadSource;
  createdAt?: string;
}

/** Semilla de etapas para un workspace nuevo (las 7 canónicas del desktop). */
export const SEED_STAGES: Array<{
  id: string;
  name: string;
  color: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
}> = [
  { id: "prospecto", name: "Prospecto", color: "#64748B", order: 0 },
  { id: "contactado", name: "Contactado", color: "#3B82F6", order: 1 },
  { id: "visita-agendada", name: "Visita agendada", color: "#8B5CF6", order: 2 },
  { id: "presupuestado", name: "Presupuestado", color: "#F59E0B", order: 3 },
  { id: "negociando", name: "Negociando", color: "#E11D48", order: 4 },
  { id: "cerrado", name: "Cerrado", color: "#10B981", order: 5, isWon: true },
  { id: "perdido", name: "Perdido", color: "#EF4444", order: 6, isLost: true },
];

/* ───────── Templates de pipeline por rubro (F3) ─────────
 * Al crear un workspace se siembra el embudo del rubro elegido (no ids fijos:
 * el Worker genera uno único por etapa). Cada template tiene exactamente una
 * etapa ganada y una perdida (requisito del pipeline). "generic" es el fallback. */
export interface SeedStage {
  name: string;
  color: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
}

export const INDUSTRY_TEMPLATES: Record<string, { label: string; stages: SeedStage[] }> = {
  generic: {
    label: "Genérico",
    stages: [
      { name: "Prospecto", color: "#64748B", order: 0 },
      { name: "Contactado", color: "#3B82F6", order: 1 },
      { name: "Presupuestado", color: "#F59E0B", order: 2 },
      { name: "Negociando", color: "#E11D48", order: 3 },
      { name: "Ganado", color: "#10B981", order: 4, isWon: true },
      { name: "Perdido", color: "#EF4444", order: 5, isLost: true },
    ],
  },
  tech: {
    label: "Celulares y tecnología",
    stages: [
      { name: "Consulta", color: "#64748B", order: 0 },
      { name: "Presupuesto", color: "#3B82F6", order: 1 },
      { name: "Seña / reserva", color: "#8B5CF6", order: 2 },
      { name: "Vendido", color: "#10B981", order: 3, isWon: true },
      { name: "Perdido", color: "#EF4444", order: 4, isLost: true },
    ],
  },
  apparel: {
    label: "Indumentaria y calzado",
    stages: [
      { name: "Interesado", color: "#64748B", order: 0 },
      { name: "Reservado", color: "#8B5CF6", order: 1 },
      { name: "Vendido", color: "#10B981", order: 2, isWon: true },
      { name: "No concretó", color: "#EF4444", order: 3, isLost: true },
    ],
  },
  kiosco: {
    label: "Kiosco / almacén",
    stages: [
      { name: "Consulta", color: "#64748B", order: 0 },
      { name: "Pedido", color: "#3B82F6", order: 1 },
      { name: "Entregado", color: "#10B981", order: 2, isWon: true },
      { name: "Cancelado", color: "#EF4444", order: 3, isLost: true },
    ],
  },
  gastro: {
    label: "Gastronomía",
    stages: [
      { name: "Consulta", color: "#64748B", order: 0 },
      { name: "Reserva", color: "#8B5CF6", order: 1 },
      { name: "Atendido", color: "#10B981", order: 2, isWon: true },
      { name: "Cancelado", color: "#EF4444", order: 3, isLost: true },
    ],
  },
  services: {
    label: "Servicios",
    stages: [
      { name: "Lead", color: "#64748B", order: 0 },
      { name: "Presupuesto", color: "#3B82F6", order: 1 },
      { name: "Agendado", color: "#8B5CF6", order: 2 },
      { name: "Realizado", color: "#10B981", order: 3, isWon: true },
      { name: "Perdido", color: "#EF4444", order: 4, isLost: true },
    ],
  },
  health: {
    label: "Salud / estética",
    stages: [
      { name: "Consulta", color: "#64748B", order: 0 },
      { name: "Turno agendado", color: "#8B5CF6", order: 1 },
      { name: "Atendido", color: "#10B981", order: 2, isWon: true },
      { name: "Cancelado", color: "#EF4444", order: 3, isLost: true },
    ],
  },
};

/** Rubros ofrecidos en el onboarding (key → label), en orden. */
export const INDUSTRY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "tech", label: "Celulares y tecnología" },
  { key: "apparel", label: "Indumentaria y calzado" },
  { key: "kiosco", label: "Kiosco / almacén" },
  { key: "gastro", label: "Gastronomía" },
  { key: "services", label: "Servicios" },
  { key: "health", label: "Salud / estética" },
];

/** Etapas a sembrar para un rubro; cae a "generic" si la key no existe. */
export function stagesForIndustry(key?: string | null): SeedStage[] {
  return (key && INDUSTRY_TEMPLATES[key]?.stages) || INDUSTRY_TEMPLATES.generic.stages;
}

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  final: "Consumidor final",
  revendedor: "Revendedor",
  mayorista: "Mayorista",
  empresa: "Empresa",
};
export const CLIENT_TYPES = Object.keys(CLIENT_TYPE_LABELS) as ClientType[];

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  hot: "Caliente 🔥",
};
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as LeadPriority[];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  referido: "Referido",
  "walk-in": "Walk-in",
  web: "Web",
  redes: "Redes",
  otro: "Otro",
};
export const SOURCES = Object.keys(SOURCE_LABELS) as LeadSource[];

/* ───────── Ventas ───────── */
export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta"
  | "mercadopago"
  | "cuenta-corriente"
  | "otro";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  mercadopago: "Mercado Pago",
  "cuenta-corriente": "Cuenta corriente",
  otro: "Otro",
};
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

export interface SaleItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imei?: string | null;
}

export interface SalePayment {
  id: string;
  method: string;
  currency: Currency;
  amount: number;
  isDeposit: boolean;
}

/** Cabecera de venta (lo que devuelve el listado). */
export interface Sale {
  id: string;
  customerId?: string;
  customerName: string;
  sellerName?: string;
  subtotal: number;
  total: number;
  totalPaid: number;
  balance: number;
  isPaid: boolean;
  paymentMethod?: string;
  notes?: string;
  saleDate?: string;
  createdAt?: string;
}

/** Venta con items + pagos (GET de una venta). */
export interface SaleDetail extends Sale {
  items: SaleItem[];
  payments: SalePayment[];
}

/** Precio de un producto para un tipo de cliente (precios por tipo). */
export interface CatalogPrice {
  catalogItemId: string;
  customerType: ClientType;
  price: number;
}

/** Ítem de venta "plano" del endpoint bulk /sale-items (para Reportes v2).
 *  Trae la fecha de la venta + el catalog_item_id para cruzar con el costo. */
export interface SaleItemReport {
  id: string;
  saleId: string;
  catalogItemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Costo unitario congelado en la venta (snapshot). null/0 = sin snapshot
   *  (venta vieja) → el consumidor usa el costo actual del catálogo. */
  unitCost?: number | null;
  saleDate?: string | null;
  sellerName?: string | null;
}
