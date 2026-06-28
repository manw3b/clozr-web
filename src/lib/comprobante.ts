/**
 * Comprobante de venta (PDF no fiscal). Arma un HTML lindo y lo manda a
 * imprimir en un iframe oculto: el navegador permite "Guardar como PDF" y
 * desde ahí se comparte por WhatsApp. Sin dependencias ni llamadas extra.
 *
 * NO es una factura fiscal (sin CAE/AFIP). Es un comprobante de compra.
 */
import { formatMoney } from "./format";
import { PAYMENT_METHOD_LABELS, saleCode } from "./types";
import type { SaleDetail } from "./types";

export interface ComprobanteBusiness {
  name: string;
  logoUrl?: string | null;
}

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
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " · " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function payLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method;
}

function buildHtml(business: ComprobanteBusiness, sale: SaleDetail): string {
  const ref = saleCode(sale) ?? sale.id.slice(-6).toUpperCase();
  const rows = sale.items
    .map((it) => {
      const unit = it.quantity > 0 ? it.subtotal / it.quantity : it.subtotal;
      const cur = (it.currency ?? "ARS") === "USD" ? "USD" : "ARS";
      return `<tr>
        <td class="c">${it.quantity}</td>
        <td>${esc(it.description)}${it.imei ? `<span class="dim"> · IMEI ${esc(it.imei)}</span>` : ""}</td>
        <td class="r">${formatMoney(unit, cur)}</td>
        <td class="r">${formatMoney(it.subtotal, cur)}</td>
      </tr>`;
    })
    .join("");

  const payments = sale.payments.length
    ? `<div class="block"><div class="lbl">Pagos</div>${sale.payments
        .map((p) => `<div class="kv"><span>${esc(payLabel(p.method))}</span><span>${formatMoney(p.amount, p.currency)}</span></div>`)
        .join("")}</div>`
    : "";

  // US$-nativo: Total/Cobrado/Saldo en dólares (fuente de verdad) con el peso
  // congelado de la venta como referencia "≈". Las ventas legacy (totalUsd
  // null) caen a pesos como antes. Cada ítem ya se muestra en su propia moneda.
  const isUsd = sale.totalUsd != null;
  const pair = (usd: number | null | undefined, ars: number): string =>
    isUsd && usd != null
      ? `${formatMoney(usd, "USD")}<span class="dim"> · ≈ ${formatMoney(ars, "ARS")}</span>`
      : formatMoney(ars, "ARS");
  const hasBalance = isUsd ? (sale.balanceUsd ?? 0) > 0.01 : sale.balance > 0.01;
  const saldo = hasBalance
    ? `<div class="kv total"><span>Saldo pendiente</span><span class="warn">${pair(sale.balanceUsd, sale.balance)}</span></div>`
    : `<div class="kv"><span>Estado</span><span class="ok">Pagado</span></div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Comprobante ${esc(ref)}</title>
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
  .totals { margin-left: auto; width: 260px; }
  .kv { display: flex; justify-content: space-between; padding: 4px 0; }
  .kv.total { border-top: 2px solid #111827; margin-top: 6px; padding-top: 8px; font-weight: 800; font-size: 15px; }
  .warn { color: #b45309; font-weight: 700; }
  .ok { color: #15803d; font-weight: 700; }
  .block { margin-top: 16px; }
  .notes { margin-top: 16px; padding: 10px 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #374151; }
  .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  @page { margin: 14mm; }
</style></head>
<body><div class="wrap">
  <div class="head">
    ${business.logoUrl ? `<img class="logo" src="${esc(business.logoUrl)}" alt="">` : ""}
    <div class="biz">${esc(business.name)}</div>
    <div class="meta"><div class="tag">Comprobante de venta</div><div class="ref">N° ${esc(ref)}</div></div>
  </div>
  <div class="disc">Documento no válido como factura.</div>
  <div class="row2">
    <div><div class="lbl">Cliente</div><div>${esc(sale.customerName || "Consumidor final")}</div></div>
    <div style="text-align:right"><div class="lbl">Fecha</div><div>${esc(fmtDate(sale.saleDate ?? sale.createdAt))}</div>${sale.sellerName ? `<div class="dim">Vendedor: ${esc(sale.sellerName)}</div>` : ""}</div>
  </div>
  <table>
    <thead><tr><th class="c">Cant.</th><th>Detalle</th><th class="r">P. unit.</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" class="dim">Sin ítems</td></tr>`}</tbody>
  </table>
  <div class="totals">
    <div class="kv total"><span>Total</span><span>${pair(sale.totalUsd, sale.total)}</span></div>
    <div class="kv"><span>Cobrado</span><span>${pair(sale.totalPaidUsd, sale.totalPaid)}</span></div>
    ${saldo}
  </div>
  ${payments}
  ${sale.notes ? `<div class="notes">${esc(sale.notes)}</div>` : ""}
  <div class="foot">Generado con Clozr · ${esc(fmtDate(new Date().toISOString()))}</div>
</div></body></html>`;
}

/** Comprobante en TEXTO plano (con formato WhatsApp) para compartir por chat. */
export function buildComprobanteText(business: ComprobanteBusiness, sale: SaleDetail): string {
  const ref = saleCode(sale) ?? sale.id.slice(-6).toUpperCase();
  const L: string[] = [];
  L.push(`🧾 *${business.name || "Comprobante"}*`);
  L.push(`Comprobante N° ${ref}`);
  L.push("");
  L.push(`Cliente: ${sale.customerName || "Consumidor final"}`);
  const date = fmtDate(sale.saleDate ?? sale.createdAt);
  if (date) L.push(`Fecha: ${date}`);
  L.push("");
  if (sale.items.length === 0) {
    L.push("• (sin ítems)");
  } else {
    for (const it of sale.items) {
      const qty = it.quantity > 1 ? `${it.quantity}× ` : "";
      const imei = it.imei ? ` (IMEI ${it.imei})` : "";
      const cur = (it.currency ?? "ARS") === "USD" ? "USD" : "ARS";
      L.push(`• ${qty}${it.description}${imei} — ${formatMoney(it.subtotal, cur)}`);
    }
  }
  L.push("————————————");
  // US$-nativo: Total/Cobrado/Saldo en dólares con el peso congelado de
  // referencia. Legacy (totalUsd null) → pesos. Cada ítem ya va en su moneda.
  const isUsdT = sale.totalUsd != null;
  const pairT = (usd: number | null | undefined, ars: number): string =>
    isUsdT && usd != null ? `${formatMoney(usd, "USD")} (≈ ${formatMoney(ars, "ARS")})` : formatMoney(ars, "ARS");
  L.push(`*Total: ${pairT(sale.totalUsd, sale.total)}*`);
  const hasBalanceT = isUsdT ? (sale.balanceUsd ?? 0) > 0.01 : sale.balance > 0.01;
  if (hasBalanceT) {
    if (sale.totalPaid > 0) L.push(`Cobrado: ${pairT(sale.totalPaidUsd, sale.totalPaid)}`);
    L.push(`Saldo pendiente: ${pairT(sale.balanceUsd, sale.balance)}`);
  } else {
    L.push("Estado: Pagado ✅");
  }
  if (sale.paymentMethod) L.push(`Forma de pago: ${payLabel(sale.paymentMethod)}`);
  L.push("");
  L.push("¡Gracias por tu compra! 🙌");
  return L.join("\n");
}

/** Abre el diálogo de impresión con el comprobante (Guardar como PDF). */
export function printComprobante(business: ComprobanteBusiness, sale: SaleDetail): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.srcdoc = buildHtml(business, sale);
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
      // Damos tiempo a que se abra el diálogo antes de remover el iframe.
      setTimeout(() => iframe.remove(), 1500);
    }
  };
  document.body.appendChild(iframe);
}
