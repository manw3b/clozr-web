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
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  status: string;
  /** Objetivo diario (monto). 0 / undefined = sin objetivo seteado. */
  dailyGoal?: number;
  dailyGoalCurrency?: string;
  /** Objetivo de cantidad de ventas del día. */
  dailyGoalCount?: number;
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
