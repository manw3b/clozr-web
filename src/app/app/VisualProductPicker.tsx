"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ArrowLeft, Check, Pencil } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { categoryEmoji } from "@/lib/productImages";
import * as api from "@/lib/api";
import { APPLE_CATALOG } from "@/lib/appleCatalog";
import type { CatCategory, CatFamily, CatModel } from "@/lib/appleCatalog";
import { useBlueRate } from "@/store/dollarStore";
import { formatArs } from "@/lib/types";
import type { Currency } from "@/lib/types";

/**
 * Picker visual de productos — wizard guiado para cargar al catálogo rápido.
 * Portado del VisualProductPicker de la desktop, sobre la data estática del
 * catálogo Apple (lib/appleCatalog.ts) + fotos en /public/products. Crea un
 * producto del catálogo (con su imagen) vía api.createProduct.
 * DIFERIDO de la desktop (necesitan backend): IMEIs unidad-por-unidad y
 * precios por tipo de cliente.
 */

type Step = "category" | "family" | "model" | "color" | "storage" | "confirm";

interface Picked {
  category?: CatCategory;
  family?: CatFamily;
  model?: CatModel;
  color?: string;
  colorHex?: string | null;
  storage?: string | null;
}

export function VisualProductPicker({
  open,
  onClose,
  onCreated,
  onSwitchToManual,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onSwitchToManual: () => void;
}) {
  const { showToast } = useUIStore();
  const blue = useBlueRate();
  const [step, setStep] = useState<Step>("category");
  const [picked, setPicked] = useState<Picked>({});
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  // Moneda del producto (precio + costo). Default USD: una tienda de tecnología
  // casi siempre piensa el costo/precio en dólares.
  const [currency, setCurrency] = useState<Currency>("USD");
  const [quantity, setQuantity] = useState("1");
  // Carga por IMEI: para iPhones (equipos serializados) el stock = nº de IMEIs.
  const [serialized, setSerialized] = useState(false);
  const [imeiText, setImeiText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("category");
      setPicked({});
      setPrice("");
      setCost("");
      setCurrency("USD");
      setQuantity("1");
      setSerialized(false);
      setImeiText("");
      setBusy(false);
    }
  }, [open]);

  // Al llegar a confirmar, por defecto "por IMEI" si es un iPhone.
  const isPhone = picked.category?.id === "cat-iphone";
  useEffect(() => {
    if (step === "confirm") setSerialized(isPhone);
  }, [step, isPhone]);

  const imeiCount = useMemo(
    () =>
      serialized
        ? new Set(imeiText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)).size
        : 0,
    [serialized, imeiText],
  );

  const colors = picked.model?.colors ?? [];
  const storages = picked.model?.storages ?? [];
  const selectedColorImage = useMemo(
    () => (picked.color ? picked.model?.colors.find((c) => c.color === picked.color)?.image ?? null : null),
    [picked.model, picked.color],
  );

  const finalName = useMemo(() => {
    if (!picked.model) return "";
    return [picked.model.name, picked.storage, picked.color].filter(Boolean).join(" ");
  }, [picked]);

  const finalImage = useMemo(() => {
    if (!picked.model) return null;
    return selectedColorImage ?? picked.model.image;
  }, [picked.model, selectedColorImage]);

  /* ── navegación ── */
  const goBack = () => {
    if (step === "confirm") setStep(storages.length > 0 ? "storage" : "color");
    else if (step === "storage") setStep("color");
    else if (step === "color") setStep("model");
    else if (step === "model") setStep("family");
    else if (step === "family") setStep("category");
  };

  const pickCategory = (c: CatCategory) => {
    setPicked({ category: c });
    setStep("family");
  };
  const pickFamily = (f: CatFamily) => {
    setPicked((p) => ({ category: p.category, family: f }));
    setStep("model");
  };
  const pickModel = (m: CatModel) => {
    setPicked((p) => ({ category: p.category, family: p.family, model: m }));
    setStep("color");
  };
  const pickColor = (c: string, hex: string | null) => {
    setPicked((p) => ({ ...p, color: c, colorHex: hex, storage: undefined }));
  };
  const advanceFromColor = () => {
    if (!picked.color) return;
    // Si el modelo no tiene storages para ese color, saltamos a confirmar.
    setStep(storages.length > 0 ? "storage" : "confirm");
  };
  const pickStorage = (s: string) => {
    setPicked((p) => ({ ...p, storage: s }));
    setStep("confirm");
  };

  async function create() {
    if (!picked.category || !picked.model) return;
    setBusy(true);
    try {
      const imeis = serialized
        ? Array.from(new Set(imeiText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)))
        : [];
      const id = await api.createProduct({
        name: finalName,
        category: picked.category.name,
        price: price ? Number(price) : 0,
        cost: cost ? Number(cost) : null,
        currency,
        trackStock: true,
        stock: serialized ? imeis.length : Math.max(0, Number(quantity) || 0),
        imagePath: finalImage ?? null,
      });
      if (serialized && imeis.length > 0) {
        await api.addCatalogImeis(id, imeis);
      }
      showToast(
        serialized && imeis.length ? `Producto creado · ${imeis.length} unidades` : "Producto creado",
        "success",
      );
      onCreated();
      onClose();
    } catch {
      showToast("No se pudo crear el producto", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const isDirty = () => step !== "category" || !!picked.category;

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      confirmCloseText="¿Cerrar y descartar el producto?"
      title="Agregar producto"
      subtitle={SUBTITLES[step]}
      maxWidth={780}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <button
            onClick={onSwitchToManual}
            style={{ fontSize: text.xs, color: color.textMuted, textDecoration: "underline", background: "transparent", cursor: "pointer" }}
          >
            <Pencil size={11} style={{ display: "inline", marginRight: 4 }} />
            Cargar manualmente
          </button>
          <div style={{ display: "flex", gap: space[2] }}>
            {step !== "category" && (
              <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={goBack}>
                Atrás
              </Button>
            )}
            {step === "color" ? (
              <Button variant="primary" onClick={advanceFromColor} disabled={!picked.color}>
                Siguiente →
              </Button>
            ) : step === "confirm" ? (
              <Button variant="primary" iconLeft={<Check size={14} />} onClick={create} loading={busy}>
                Crear producto
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Breadcrumbs picked={picked} />

      {step === "category" && (
        <Grid min={160}>
          {APPLE_CATALOG.map((c) => (
            <PickCard key={c.id} onClick={() => pickCategory(c)} height={150}>
              <span style={{ fontSize: 40 }}>{c.emoji ?? categoryEmoji(c.name)}</span>
              <CardLabel>{c.name}</CardLabel>
            </PickCard>
          ))}
        </Grid>
      )}

      {step === "family" && picked.category && (
        <Grid min={170}>
          {picked.category.families.map((f) => (
            <PickCard key={f.id} onClick={() => pickFamily(f)} height={170}>
              <ImgBox>
                <ProductImg srcs={[f.models[0]?.image]} alt={f.name} emoji={picked.category!.emoji} />
              </ImgBox>
              <CardLabel>{f.name}</CardLabel>
            </PickCard>
          ))}
        </Grid>
      )}

      {step === "model" && picked.family && (
        picked.family.models.length === 0 ? (
          <Empty msg="Esta línea todavía no tiene modelos cargados." action={<Button variant="ghost" onClick={goBack}>Volver</Button>} />
        ) : (
          <Grid min={180}>
            {picked.family.models.map((m) => (
              <PickCard key={m.id} onClick={() => pickModel(m)} height={196}>
                <ImgBox>
                  <ProductImg srcs={[m.image]} alt={m.name} emoji={picked.category?.emoji} />
                </ImgBox>
                <CardLabel>{m.name}</CardLabel>
              </PickCard>
            ))}
          </Grid>
        )
      )}

      {step === "color" && picked.model && (
        <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
          <div style={{ display: "flex", justifyContent: "center", minHeight: 150 }}>
            <ProductImg
              srcs={[selectedColorImage, picked.model.image]}
              alt={picked.model.name}
              big
              emoji={picked.category?.emoji}
            />
          </div>
          {colors.length === 0 ? (
            <Empty msg="Este modelo no tiene colores definidos." action={<Button variant="primary" onClick={() => setStep("confirm")}>Continuar</Button>} />
          ) : (
            <Grid min={140}>
              {colors.map((c) => (
                <PickCard key={c.color} onClick={() => pickColor(c.color, c.colorHex)} height={104} selected={picked.color === c.color}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.colorHex ?? color.surface2, border: `1px solid ${color.border}` }} />
                  <CardLabel>{c.color}</CardLabel>
                </PickCard>
              ))}
            </Grid>
          )}
        </div>
      )}

      {step === "storage" && (
        <Grid min={120}>
          {storages.map((s) => (
            <PickCard key={s} onClick={() => pickStorage(s)} height={88}>
              <span style={{ fontSize: text.lg, fontWeight: weight.bold, color: color.text }}>{s}</span>
            </PickCard>
          ))}
        </Grid>
      )}

      {step === "confirm" && picked.model && (
        <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
          <div style={{ display: "flex", gap: space[4], alignItems: "center", background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[4] }}>
            <div style={{ width: 84, height: 84, background: color.surface, borderRadius: radius.md, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              <ProductImg srcs={[finalImage, picked.model.image]} alt={finalName} emoji={picked.category?.emoji} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: text.md, fontWeight: weight.bold, color: color.text }}>{finalName}</div>
              {picked.colorHex && (
                <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[1] }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: picked.colorHex, border: `1px solid ${color.border}` }} />
                  <span style={{ fontSize: text.xs, color: color.textMuted }}>{picked.category?.name}</span>
                </div>
              )}
            </div>
          </div>

          <ModalField label="Moneda">
            <div style={{ display: "flex", gap: space[2] }}>
              {(["USD", "ARS"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    fontSize: text.sm,
                    fontWeight: weight.medium,
                    cursor: "pointer",
                    border: `1px solid ${currency === c ? color.primary : color.border}`,
                    background: currency === c ? color.primaryBg : color.surface2,
                    color: currency === c ? color.primary : color.text,
                  }}
                >
                  {c === "USD" ? "US$ Dólares" : "$ Pesos"}
                </button>
              ))}
            </div>
          </ModalField>
          <div style={{ display: "grid", gridTemplateColumns: serialized ? "1fr 1fr" : "1fr 1fr 120px", gap: space[3] }}>
            <ModalField
              label={`Precio (${currency === "USD" ? "US$" : "$"})`}
              hint={currency === "USD" && blue && Number(price) > 0 ? `≈ ${formatArs(Number(price) * blue)} al blue` : undefined}
            >
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" autoFocus />
            </ModalField>
            <ModalField label={`Costo (${currency === "USD" ? "US$" : "$"})`} hint="Opcional">
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </ModalField>
            {!serialized && (
              <ModalField label="Stock">
                <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1" />
              </ModalField>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: space[2], cursor: "pointer" }}>
            <input type="checkbox" checked={serialized} onChange={(e) => setSerialized(e.target.checked)} />
            <span style={{ fontSize: text.sm, color: color.text }}>
              Cargar por IMEI / N° de serie{" "}
              <span style={{ color: color.textDim }}>· cada equipo es una unidad</span>
            </span>
          </label>

          {serialized && (
            <div>
              <textarea
                value={imeiText}
                onChange={(e) => setImeiText(e.target.value)}
                placeholder={"Pegá un IMEI por línea\n352099001761481\n352099001761482"}
                rows={4}
                style={{
                  width: "100%",
                  resize: "vertical",
                  minHeight: 88,
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: "8px 10px",
                  color: color.text,
                  fontSize: text.sm,
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              />
              <div style={{ marginTop: space[1], fontSize: text.xs, color: color.textMuted }}>
                {imeiCount} {imeiCount === 1 ? "unidad" : "unidades"} · el stock se calcula de los IMEIs cargados
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const SUBTITLES: Record<Step, string> = {
  category: "Elegí la categoría.",
  family: "¿Qué línea?",
  model: "Elegí el modelo.",
  color: "Elegí el color.",
  storage: "Elegí el almacenamiento.",
  confirm: "Precio y stock para terminar.",
};

/* ── sub-componentes ── */

function Breadcrumbs({ picked }: { picked: Picked }) {
  const items: string[] = [];
  if (picked.category) items.push(`${picked.category.emoji ?? ""} ${picked.category.name}`.trim());
  if (picked.family) items.push(picked.family.name);
  if (picked.model) items.push(picked.model.name);
  if (picked.color) items.push(picked.color);
  if (picked.storage) items.push(picked.storage);
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: space[1], marginBottom: space[4], fontSize: text.xs, color: color.textMuted }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <ChevronRight size={11} />}
          <span style={{ color: i === items.length - 1 ? color.text : color.textMuted, fontWeight: i === items.length - 1 ? weight.semibold : weight.medium }}>
            {it}
          </span>
        </span>
      ))}
    </div>
  );
}

function Grid({ min = 160, children }: { min?: number; children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: space[3] }}>{children}</div>;
}

function PickCard({
  onClick,
  children,
  height = 150,
  selected = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  height?: number;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        background: color.surface,
        border: `1px solid ${selected ? color.primary : color.border}`,
        borderRadius: radius.md,
        padding: space[3],
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        cursor: "pointer",
        transition: "all 120ms",
        textAlign: "center",
        boxShadow: selected ? `0 0 0 3px ${color.primaryBg}` : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color.primary;
        e.currentTarget.style.background = color.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = selected ? color.primary : color.border;
        e.currentTarget.style.background = color.surface;
      }}
    >
      {children}
    </button>
  );
}

function ImgBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: color.surface2, borderRadius: radius.sm }}>
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{children}</span>;
}

/** <img> que prueba varias fuentes en orden (onError avanza) y cae a un emoji. */
function ProductImg({
  srcs,
  alt,
  emoji,
  big = false,
}: {
  srcs: (string | null | undefined)[];
  alt: string;
  emoji?: string | null;
  big?: boolean;
}) {
  const list = srcs.filter(Boolean) as string[];
  const key = list.join("|");
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [key]);
  const maxH = big ? 150 : 100;
  if (list.length === 0 || idx >= list.length) {
    return <span style={{ fontSize: big ? 64 : 32 }}>{emoji ?? "📦"}</span>;
  }
  return (
    <img
      src={list[idx]}
      alt={alt}
      onError={() => setIdx((i) => i + 1)}
      style={{ maxWidth: "85%", maxHeight: maxH, objectFit: "contain" }}
    />
  );
}

function Empty({ msg, action }: { msg: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: space[5], textAlign: "center", color: color.textMuted, fontSize: text.sm, display: "flex", flexDirection: "column", alignItems: "center", gap: space[3] }}>
      <span>{msg}</span>
      {action}
    </div>
  );
}
