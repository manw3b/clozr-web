import { ImageResponse } from "next/og";

// Metadata de la imagen — Next cablea solo <meta og:image*> en el <head>.
export const alt = "Clozr — El sistema operativo para tu negocio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Partículas deterministas (sin random → build estable). x/y en %, s en px.
const PARTICLES = [
  { x: 64, y: 12, s: 5, o: 0.55 }, { x: 78, y: 22, s: 3, o: 0.4 },
  { x: 88, y: 16, s: 4, o: 0.5 }, { x: 72, y: 40, s: 3, o: 0.35 },
  { x: 92, y: 46, s: 5, o: 0.45 }, { x: 83, y: 60, s: 3, o: 0.3 },
  { x: 69, y: 72, s: 4, o: 0.4 }, { x: 90, y: 78, s: 3, o: 0.3 },
  { x: 58, y: 86, s: 4, o: 0.35 }, { x: 50, y: 28, s: 2, o: 0.25 },
  { x: 40, y: 70, s: 2, o: 0.22 }, { x: 30, y: 18, s: 3, o: 0.25 },
  { x: 18, y: 84, s: 4, o: 0.3 }, { x: 12, y: 50, s: 2, o: 0.2 },
];

const BARS = [24, 32, 28, 40, 36, 48, 44, 56, 52, 64];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "row",
          background: "#0B0B0D", color: "#fff", position: "relative", overflow: "hidden",
        }}
      >
        {/* Glow rojo radial (dos capas) */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(620px 460px at 80% 26%, rgba(225,29,72,0.26), transparent 62%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(520px 520px at 6% 90%, rgba(225,29,72,0.10), transparent 60%)" }} />

        {/* Partículas */}
        {PARTICLES.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, borderRadius: p.s, background: `rgba(255,59,107,${p.o})` }} />
        ))}

        {/* ── Izquierda: tipografía ── */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 720, padding: "62px 24px 56px 76px", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.6 }}>
              <div style={{ display: "flex" }}>Dejá el Excel.</div>
              <div style={{ display: "flex", color: "#FF3B6B" }}>Cerrá más ventas.</div>
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 27, color: "rgba(255,255,255,0.6)" }}>
              El sistema operativo para tu negocio.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10, background: "#E11D48", fontSize: 23, fontWeight: 800 }}>C</div>
              <div style={{ display: "flex", fontSize: 31, fontWeight: 700, letterSpacing: -0.5 }}>Clozr</div>
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 9, fontSize: 18, color: "rgba(255,255,255,0.45)" }}>
              <div style={{ display: "flex", width: 16, height: 16, borderRadius: 16, border: "1.5px solid rgba(255,59,107,0.85)", backgroundImage: "radial-gradient(circle at 34% 30%, rgba(255,59,107,0.55), transparent 70%)" }} />
              <div style={{ display: "flex" }}>Hecho para negocios de LATAM</div>
            </div>
          </div>
        </div>

        {/* ── Derecha: dashboard (tilt sutil) ── */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div
            style={{
              display: "flex", flexDirection: "column", gap: 16, width: 420, padding: 22, borderRadius: 22,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 0 70px rgba(225,29,72,0.22), 0 28px 70px rgba(0,0,0,0.55)",
              transform: "rotate(-5deg)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 7 }}>
              <div style={{ display: "flex", width: 11, height: 11, borderRadius: 11, background: "#ff5f57" }} />
              <div style={{ display: "flex", width: 11, height: 11, borderRadius: 11, background: "#febc2e" }} />
              <div style={{ display: "flex", width: 11, height: 11, borderRadius: 11, background: "#28c840" }} />
              <div style={{ display: "flex", marginLeft: 8, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Resumen</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Ventas del mes</div>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>$98.540.000</div>
              <div style={{ display: "flex", fontSize: 14, color: "#22C55E", marginTop: 2 }}>+28% vs mes anterior</div>
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 7, height: 66 }}>
              {BARS.map((h, i) => (
                <div key={i} style={{ display: "flex", width: 13, height: h, borderRadius: 4, background: "linear-gradient(180deg, #FF3B6B, rgba(255,59,107,0.35))" }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "row", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Clientes</div>
                <div style={{ display: "flex", fontSize: 18, fontWeight: 700, marginTop: 2 }}>1.250</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Oportunidades</div>
                <div style={{ display: "flex", fontSize: 18, fontWeight: 700, marginTop: 2 }}>32</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
