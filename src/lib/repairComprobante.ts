/**
 * Comprobantes del taller (NO fiscales): recibo de INGRESO (al recibir el equipo)
 * y comprobante de ENTREGA con garantía (al devolverlo reparado). Genera un HTML
 * imprimible (Guardar como PDF, igual que el de ventas) + una versión en texto
 * para compartir por WhatsApp. Mismo estilo visual que `comprobante.ts`.
 */
import { formatMoney } from "./format";
import type { ComprobanteBusiness } from "./comprobante";
import type { Repair } from "./types";
import type { RepairPart } from "./api";

export type RepairDocMode = "intake" | "delivery";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  );
}

function repairRef(r: Repair): string {
  return r.orderSeq != null ? String(r.orderSeq) : r.id.slice(-6).toUpperCase();
}

function partsTotal(parts: RepairPart[]): number {
  return parts.reduce((a, p) => a + p.subtotal, 0);
}

/** Total del trabajo: repuestos (itemizados o el número suelto) + mano de obra. */
function workTotal(r: Repair, parts: RepairPart[]): number {
  const partsCost = parts.length ? partsTotal(parts) : (r.partsCost ?? 0);
  return partsCost + (r.laborCost ?? 0);
}

/** Fecha hasta la que aplica la garantía (entrega + N meses). "" si no hay. */
function warrantyUntil(r: Repair): string {
  const months = r.warrantyMonths ?? 0;
  if (months <= 0) return "";
  const base = r.deliveredAt ? new Date(r.deliveredAt) : new Date();
  if (isNaN(base.getTime())) return "";
  const until = new Date(base);
  until.setMonth(until.getMonth() + months);
  return until.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildHtml(business: ComprobanteBusiness, r: Repair, parts: RepairPart[], mode: RepairDocMode): string {
  const isDelivery = mode === "delivery";
  const ref = repairRef(r);
  const docTitle = isDelivery ? "Comprobante de entrega" : "Recibo de ingreso";
  const partsCost = parts.length ? partsTotal(parts) : (r.partsCost ?? 0);
  const laborCost = r.laborCost ?? 0;
  const total = partsCost + laborCost;
  const deposit = r.deposit ?? 0;
  const saldo = Math.max(0, total - deposit);
  const date = fmtDate(isDelivery ? (r.deliveredAt ?? new Date().toISOString()) : (r.receivedAt ?? r.createdAt));
  const warranty = warrantyUntil(r);

  const partsRows = parts
    .map((p) => `<tr><td class="c">${p.quantity}</td><td>${esc(p.description)}</td><td class="r">${formatMoney(p.subtotal)}</td></tr>`)
    .join("");

  const intakeBody = `
    <div class="block"><div class="lbl">Falla declarada</div><div>${esc(r.problem) || "—"}</div></div>
    ${total > 0 || deposit > 0 ? `<div class="totals">
      ${total > 0 ? `<div class="kv"><span>Presupuesto estimado</span><span>${formatMoney(total)}</span></div>` : ""}
      ${deposit > 0 ? `<div class="kv"><span>Seña / anticipo</span><span>${formatMoney(deposit)}</span></div>` : ""}
      ${deposit > 0 && total > 0 ? `<div class="kv total"><span>Saldo</span><span>${formatMoney(saldo)}</span></div>` : ""}
    </div>` : ""}`;

  const deliveryBody = `
    ${r.diagnosis ? `<div class="block"><div class="lbl">Trabajo realizado</div><div>${esc(r.diagnosis)}</div></div>` : ""}
    ${parts.length ? `<table><thead><tr><th class="c">Cant.</th><th>Repuesto</th><th class="r">Subtotal</th></tr></thead><tbody>${partsRows}</tbody></table>` : ""}
    <div class="totals">
      ${partsCost > 0 ? `<div class="kv"><span>Repuestos</span><span>${formatMoney(partsCost)}</span></div>` : ""}
      ${laborCost > 0 ? `<div class="kv"><span>Mano de obra</span><span>${formatMoney(laborCost)}</span></div>` : ""}
      ${deposit > 0 ? `<div class="kv"><span>Total</span><span>${formatMoney(total)}</span></div>` : ""}
      ${deposit > 0 ? `<div class="kv"><span>Seña / anticipo</span><span>− ${formatMoney(deposit)}</span></div>` : ""}
      <div class="kv total"><span>${deposit > 0 ? "Saldo a pagar" : "Total"}</span><span>${formatMoney(deposit > 0 ? saldo : total)}</span></div>
    </div>
    ${warranty ? `<div class="block"><div class="lbl">Garantía</div><div class="ok">${r.warrantyMonths} ${r.warrantyMonths === 1 ? "mes" : "meses"} — válida hasta ${esc(warranty)}</div></div>` : ""}`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(docTitle)} ${esc(ref)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 28px; font-size: 13px; line-height: 1.45; }
  .wrap { max-width: 620px; margin: 0 auto; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #111827; padding-bottom: 14px; }
  .logo { width: 54px; height: 54px; object-fit: contain; flex-shrink: 0; }
  .biz { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
  .head .meta { margin-left: auto; text-align: right; }
  .tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
  .ref { font-size: 13px; font-weight: 700; }
  .disc { font-size: 11px; color: #9ca3af; margin: 6px 0 18px; }
  .row2 { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }
  td { padding: 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  td.c, th.c { text-align: center; width: 44px; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  .dim { color: #9ca3af; font-size: 11px; }
  .block { margin-top: 16px; }
  .totals { margin-left: auto; width: 280px; margin-top: 16px; }
  .kv { display: flex; justify-content: space-between; padding: 4px 0; }
  .kv.total { border-top: 2px solid #111827; margin-top: 6px; padding-top: 8px; font-weight: 800; font-size: 15px; }
  .ok { color: #15803d; font-weight: 700; }
  .notes { margin-top: 16px; padding: 10px 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #374151; }
  .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  @page { margin: 14mm; }
</style></head>
<body><div class="wrap">
  <div class="head">
    ${business.logoUrl ? `<img class="logo" src="${esc(business.logoUrl)}" alt="">` : ""}
    <div class="biz">${esc(business.name)}</div>
    <div class="meta"><div class="tag">${esc(docTitle)}</div><div class="ref">N° ${esc(ref)}</div></div>
  </div>
  <div class="disc">Documento no fiscal — ${isDelivery ? "constancia de entrega de equipo reparado." : "constancia de recepción de equipo para reparación."}</div>
  <div class="row2">
    <div><div class="lbl">Cliente</div><div>${esc(r.customerName || "Consumidor final")}</div>${r.customerPhone ? `<div class="dim">${esc(r.customerPhone)}</div>` : ""}</div>
    <div style="text-align:right"><div class="lbl">${isDelivery ? "Entrega" : "Ingreso"}</div><div>${esc(date)}</div>${r.technician ? `<div class="dim">Técnico: ${esc(r.technician)}</div>` : ""}</div>
  </div>
  <div class="block"><div class="lbl">Equipo</div>
    <div>${esc(r.deviceModel || "Equipo")}${r.deviceImei ? ` <span class="dim">· IMEI/Serie ${esc(r.deviceImei)}</span>` : ""}</div>
    ${r.accessories ? `<div class="dim">Accesorios: ${esc(r.accessories)}</div>` : ""}
    ${!isDelivery && r.devicePasscode ? `<div class="dim">Clave/patrón: ${esc(r.devicePasscode)}</div>` : ""}
  </div>
  ${isDelivery ? deliveryBody : intakeBody}
  ${r.notes ? `<div class="notes">${esc(r.notes)}</div>` : ""}
  <div class="foot">${isDelivery ? "¡Gracias por confiar en nosotros!" : "Conservá este comprobante para retirar tu equipo."} · Generado con Clozr</div>
</div></body></html>`;
}

/** Abre el diálogo de impresión con el comprobante del taller (Guardar como PDF). */
export function printRepairComprobante(
  business: ComprobanteBusiness,
  repair: Repair,
  parts: RepairPart[],
  mode: RepairDocMode,
): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.srcdoc = buildHtml(business, repair, parts, mode);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  };
  document.body.appendChild(iframe);
}

/** Comprobante del taller en TEXTO (WhatsApp) para compartir por chat. */
export function buildRepairText(
  business: ComprobanteBusiness,
  r: Repair,
  parts: RepairPart[],
  mode: RepairDocMode,
): string {
  const isDelivery = mode === "delivery";
  const L: string[] = [];
  L.push(`🧾 *${business.name || "Taller"}*`);
  L.push(`${isDelivery ? "Comprobante de entrega" : "Recibo de ingreso"} N° ${repairRef(r)}`);
  L.push("");
  L.push(`Cliente: ${r.customerName || "Consumidor final"}`);
  L.push(`Equipo: ${r.deviceModel || "Equipo"}${r.deviceImei ? ` (IMEI/Serie ${r.deviceImei})` : ""}`);
  if (!isDelivery) {
    if (r.problem) L.push(`Falla: ${r.problem}`);
    const est = workTotal(r, parts);
    if (est > 0) L.push(`Presupuesto estimado: ${formatMoney(est)}`);
    if ((r.deposit ?? 0) > 0) {
      L.push(`Seña: ${formatMoney(r.deposit ?? 0)}`);
      if (est > 0) L.push(`Saldo: ${formatMoney(Math.max(0, est - (r.deposit ?? 0)))}`);
    }
    L.push("");
    L.push("Conservá este mensaje para retirar tu equipo. ¡Gracias!");
  } else {
    if (r.diagnosis) L.push(`Trabajo: ${r.diagnosis}`);
    const t = workTotal(r, parts);
    const dep = r.deposit ?? 0;
    if (dep > 0) {
      L.push(`Total: ${formatMoney(t)}`);
      L.push(`Seña: ${formatMoney(dep)}`);
      L.push(`*Saldo a pagar: ${formatMoney(Math.max(0, t - dep))}*`);
    } else {
      L.push(`*Total: ${formatMoney(t)}*`);
    }
    const w = warrantyUntil(r);
    if (w) L.push(`Garantía: ${r.warrantyMonths} ${r.warrantyMonths === 1 ? "mes" : "meses"} (hasta ${w})`);
    L.push("");
    L.push("¡Gracias por confiar en nosotros! 🙌");
  }
  return L.join("\n");
}
