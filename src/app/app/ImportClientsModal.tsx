"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileText, AlertCircle, Check } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Select } from "@/components/Input";
import { useUIStore } from "@/store/uiStore";
import { parseCsv } from "@/lib/csv";
import { parseVCard } from "@/lib/parseVCard";
import * as api from "@/lib/api";
import { color, radius, space, text, weight } from "@/tokens";
import type { ClientType } from "@/lib/types";

/**
 * Importador de clientes desde CSV/TSV/vCard. Portado del desktop, adaptado a
 * la web: crea en lote con `api.createCustomer` (loop secuencial con progreso),
 * dedupe por teléfono normalizado contra los clientes existentes.
 *
 * Flow: subir/arrastrar archivo → parsear → mapear columnas → preview →
 * confirmar → alta en lote.
 */

type FieldMapping = "name" | "phone" | "email" | "notes" | "ignore";

const FIELD_OPTIONS: Array<{ value: FieldMapping; label: string }> = [
  { value: "ignore", label: "— Ignorar —" },
  { value: "name", label: "Nombre" },
  { value: "phone", label: "Teléfono" },
  { value: "email", label: "Email" },
  { value: "notes", label: "Notas" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama tras importar OK para que el caller recargue la lista. */
  onImported: () => void;
}

export function ImportClientsModal({ open, onClose, onImported }: Props) {
  const { showToast } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Para abortar el loop de alta si el modal se desmonta a mitad (cambio de
  // vista/workspace) y no seguir creando clientes huérfanos / en otro espacio.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [defaultType, setDefaultType] = useState<ClientType>("final");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setMappings([]);
      setHasHeader(true);
      setDefaultType("final");
      setProgress(null);
    }
  }, [open]);

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const fileText = await file.text();
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const looksLikeVcard = ext === "vcf" || /^\s*BEGIN:VCARD/im.test(fileText);

      if (looksLikeVcard) {
        const contacts = parseVCard(fileText);
        const synthetic: string[][] = [
          ["Nombre", "Teléfono", "Email", "Notas"],
          ...contacts.map((c) => [c.name, c.phones[0] ?? "", c.emails[0] ?? "", c.notes ?? ""]),
        ];
        setRows(synthetic);
        setHasHeader(true);
        setMappings(["name", "phone", "email", "notes"]);
        return;
      }

      const parsed = parseCsv(fileText);
      setRows(parsed);
      const first = parsed[0] ?? [];
      const cols = first.length;
      const auto: FieldMapping[] = first.map((cell) => guessField(cell));
      while (auto.length < cols) auto.push("ignore");
      setMappings(auto);
      setHasHeader(looksLikeHeader(first));
    } catch {
      showToast("No se pudo leer el archivo", "error");
    } finally {
      setParsing(false);
    }
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const previewRows = dataRows.slice(0, 5);

  const stats = useMemo(() => {
    const nameIdx = mappings.indexOf("name");
    let valid = 0;
    let noName = 0;
    for (const r of dataRows) {
      const name = nameIdx >= 0 ? (r[nameIdx] ?? "").trim() : "";
      if (name.length >= 2) valid++;
      else noName++;
    }
    return { valid, invalid: noName };
  }, [dataRows, mappings]);

  async function runImport() {
    const nameIdx = mappings.indexOf("name");
    if (nameIdx < 0) {
      showToast("Mapeá una columna como Nombre", "error");
      return;
    }
    setImporting(true);
    setProgress(null);
    // Capturamos el workspace al arrancar: si cambia a mitad (el switcher
    // escribe localStorage sincrónicamente), abortamos para no crear clientes
    // en el espacio equivocado (regla de oro: scope por workspace_id).
    const startWid = api.getWorkspaceId();
    try {
      const phoneIdx = mappings.indexOf("phone");
      const emailIdx = mappings.indexOf("email");
      const notesIdx = mappings.indexOf("notes");

      // Dedupe por teléfono normalizado contra los clientes existentes (fresh).
      const existing = await api.listCustomers();
      const existingPhones = new Set(
        existing.map((c) => normalizePhone(c.phone ?? "")).filter(Boolean),
      );

      const toCreate = dataRows.filter((r) => (r[nameIdx] ?? "").trim().length >= 2);
      let created = 0;
      let deduped = 0;
      let failed = 0;
      setProgress({ done: 0, total: toCreate.length });

      for (const r of toCreate) {
        // Abortar si el modal se desmontó o cambió el workspace.
        if (!mountedRef.current || api.getWorkspaceId() !== startWid) return;

        const name = (r[nameIdx] ?? "").trim();
        const phone = phoneIdx >= 0 ? (r[phoneIdx] ?? "").trim() || undefined : undefined;
        const normalized = phone ? normalizePhone(phone) : "";
        if (normalized && existingPhones.has(normalized)) {
          deduped++;
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
          continue;
        }
        try {
          await api.createCustomer({
            name,
            phone,
            email: emailIdx >= 0 ? (r[emailIdx] ?? "").trim() || undefined : undefined,
            type: defaultType,
            notes: notesIdx >= 0 ? (r[notesIdx] ?? "").trim() || undefined : undefined,
          });
          created++;
          // Marcamos el teléfono como visto SOLO si el alta fue OK (un error
          // no debe "envenenar" el dedupe de las filas siguientes).
          if (normalized) existingPhones.add(normalized);
        } catch {
          failed++;
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }

      if (!mountedRef.current) return;

      const parts = [`${created} ${created === 1 ? "importado" : "importados"}`];
      if (deduped > 0) parts.push(`${deduped} ${deduped === 1 ? "duplicado" : "duplicados"}`);
      if (failed > 0) parts.push(`${failed} con error`);
      showToast(parts.join(" · "), created > 0 ? "success" : failed > 0 ? "error" : "info");
      onImported();
      // Si todo falló, dejamos el modal abierto para reintentar.
      if (!(created === 0 && failed > 0)) onClose();
    } catch {
      showToast("Error al importar", "error");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const canImport = rows.length > 0 && mappings.includes("name") && stats.valid > 0;

  return (
    <Modal
      open={open}
      onClose={importing ? () => {} : onClose}
      title="Importar clientes"
      subtitle="Acepta CSV, TSV o vCard (.vcf) — exportá tus contactos del celular y subilos acá"
      maxWidth={680}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={runImport} disabled={!canImport || importing}>
            {importing
              ? progress
                ? `Importando ${progress.done}/${progress.total}…`
                : "Importando…"
              : `Importar${stats.valid > 0 ? ` ${stats.valid} ${stats.valid === 1 ? "cliente" : "clientes"}` : ""}`}
          </Button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.vcf,text/csv,text/tab-separated-values,text/vcard,text/x-vcard"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {rows.length === 0 ? (
        <div
          onClick={pickFile}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: space[2],
            padding: `${space[8]} ${space[5]}`,
            border: `2px dashed ${color.border}`,
            borderRadius: radius.md,
            background: color.surface2,
            cursor: "pointer",
            transition: "all 100ms",
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = color.primary;
            e.currentTarget.style.background = color.primaryBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = color.border;
            e.currentTarget.style.background = color.surface2;
          }}
        >
          <Upload size={32} color={color.textMuted} strokeWidth={1.6} />
          <div style={{ fontSize: text.base, fontWeight: weight.semibold, color: color.text }}>
            {parsing ? "Procesando…" : "Arrastrá un archivo o hacé click"}
          </div>
          <div style={{ fontSize: text.xs, color: color.textMuted, maxWidth: 420 }}>
            Acepta <strong>.csv</strong> (Excel, Google Sheets), <strong>.tsv</strong> y{" "}
            <strong>.vcf</strong> (contactos exportados de iPhone, Android, Gmail). Para vCard el
            mapeo se hace solo.
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: space[2],
              padding: `${space[2]} ${space[3]}`,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              marginBottom: space[4],
            }}
          >
            <FileText size={14} color={color.textMuted} />
            <span style={{ fontSize: text.sm, color: color.text, flex: 1 }}>
              {rows.length} {rows.length === 1 ? "fila" : "filas"} en el archivo
            </span>
            <button
              onClick={() => setRows([])}
              disabled={importing}
              style={{ fontSize: text.xs, color: color.textMuted, padding: 0, background: "transparent", cursor: "pointer" }}
            >
              Cambiar archivo
            </button>
          </div>

          <ModalField label="¿La primera fila tiene los nombres de columnas?">
            <div style={{ display: "flex", gap: space[3], alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" checked={hasHeader} onChange={() => setHasHeader(true)} />
                <span style={{ fontSize: text.sm }}>Sí (saltear primera fila)</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" checked={!hasHeader} onChange={() => setHasHeader(false)} />
                <span style={{ fontSize: text.sm }}>No</span>
              </label>
            </div>
          </ModalField>

          <ModalField label="Mapeá cada columna a un campo de cliente">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: space[2],
              }}
            >
              {mappings.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: space[2],
                    background: color.surface2,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: weight.semibold,
                      color: color.textDim,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: 4,
                    }}
                  >
                    Columna {idx + 1}
                  </div>
                  <div
                    style={{
                      fontSize: text.xs,
                      color: color.textMuted,
                      marginBottom: 6,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={hasHeader ? rows[0]?.[idx] : `(ej: ${rows[0]?.[idx] ?? ""})`}
                  >
                    {hasHeader
                      ? rows[0]?.[idx] || "Sin título"
                      : `Ej: ${(rows[0]?.[idx] ?? "").slice(0, 30)}`}
                  </div>
                  <Select
                    value={m}
                    onChange={(e) => {
                      const next = [...mappings];
                      next[idx] = e.target.value as FieldMapping;
                      setMappings(next);
                    }}
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </ModalField>

          <ModalField label="Tipo de cliente por default">
            <Select value={defaultType} onChange={(e) => setDefaultType(e.target.value as ClientType)}>
              <option value="final">Final</option>
              <option value="revendedor">Revendedor</option>
              <option value="mayorista">Mayorista</option>
              <option value="empresa">Empresa</option>
            </Select>
          </ModalField>

          {previewRows.length > 0 && (
            <ModalField label="Preview (primeras 5 filas)">
              <div
                style={{
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.sm,
                  overflow: "auto",
                  maxHeight: 200,
                }}
              >
                <table
                  style={{ width: "100%", borderCollapse: "collapse", fontSize: text.xs, color: color.text }}
                >
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom:
                            i === previewRows.length - 1 ? "none" : `1px solid ${color.border}`,
                        }}
                      >
                        {r.map((cell, j) => (
                          <td
                            key={j}
                            style={{
                              padding: "6px 10px",
                              maxWidth: 160,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              opacity: mappings[j] === "ignore" ? 0.4 : 1,
                            }}
                            title={cell}
                          >
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ModalField>
          )}

          <div
            style={{
              display: "flex",
              gap: space[3],
              padding: space[3],
              background: color.surface2,
              borderRadius: radius.sm,
            }}
          >
            <Stat icon={<Check size={14} color={color.success} />} count={stats.valid} label="A importar" />
            {stats.invalid > 0 && (
              <Stat
                icon={<AlertCircle size={14} color={color.warning} />}
                count={stats.invalid}
                label="Sin nombre (saltear)"
              />
            )}
          </div>

          {!mappings.includes("name") && (
            <div
              style={{
                marginTop: space[3],
                padding: space[3],
                background: color.dangerBg,
                border: `1px solid ${color.danger}`,
                borderRadius: radius.sm,
                fontSize: text.xs,
                color: color.danger,
                display: "flex",
                alignItems: "center",
                gap: space[2],
              }}
            >
              <AlertCircle size={14} />
              Necesitás mapear al menos una columna como <strong>Nombre</strong>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function Stat({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text }}>{count}</span>
      <span style={{ fontSize: text.xs, color: color.textMuted }}>{label}</span>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────── */

function looksLikeHeader(row: string[]): boolean {
  if (row.length === 0) return false;
  return row.every((c) => {
    const t = c.trim();
    return t.length > 0 && t.length < 60 && Number.isNaN(Number(t.replace(/[\s.,$]/g, "")));
  });
}

function guessField(headerCell: string): FieldMapping {
  const c = headerCell.trim().toLowerCase();
  if (!c) return "ignore";
  if (
    c.includes("nombre") ||
    c.includes("name") ||
    c === "cliente" ||
    c === "contacto" ||
    c === "first name" ||
    c === "full name"
  )
    return "name";
  if (
    c.includes("tel") ||
    c.includes("phone") ||
    c.includes("cel") ||
    c.includes("móvil") ||
    c.includes("movil") ||
    c.includes("whats")
  )
    return "phone";
  if (c.includes("mail") || c === "e-mail" || c === "correo") return "email";
  if (c.includes("nota") || c.includes("note") || c.includes("coment")) return "notes";
  return "ignore";
}

function normalizePhone(s: string): string {
  return s.replace(/\D/g, "");
}
