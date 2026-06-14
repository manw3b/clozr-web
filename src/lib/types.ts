/**
 * Tipos de dominio de Clozr Web (camelCase para la UI).
 * El mapeo desde/hacia el shape snake_case del Worker vive en lib/api.ts.
 */

export type ClientType = "final" | "revendedor" | "mayorista" | "empresa";
export type LeadPriority = "low" | "medium" | "high" | "hot";
export type LeadSource = "referido" | "walk-in" | "web" | "redes" | "otro";
export type Currency = "ARS" | "USD";

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
