/**
 * Parser de vCard (.vcf) — el formato estándar para contactos.
 * Portado verbatim del desktop (sin deps de Tauri).
 *
 * Soporta vCard 2.1, 3.0 y 4.0 — los tres conviven en exports de
 * iPhone, Android, Gmail, Outlook. Devuelve una lista de contactos
 * con los campos que nos interesan: nombre, teléfono(s), email(s), notas.
 */

export interface VCardContact {
  name: string;
  phones: string[];
  emails: string[];
  notes?: string;
}

export function parseVCard(text: string): VCardContact[] {
  // Normalizar line endings y unfold continuation lines
  // (regla CRLF + WS → es continuación de la línea anterior)
  const unfolded = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");

  // Unir soft line breaks de quoted-printable: una propiedad QP cuyo valor
  // termina en '=' continúa en la línea siguiente (el '=' es el marcador de
  // continuación, no parte del valor). Sin esto, los nombres acentuados
  // (José/María/Muñoz) exportados en vCard 2.1 se rompen.
  const physical = unfolded.split("\n");
  // ¿La línea es estructural (un delimitador o una propiedad nueva) y por lo
  // tanto NO una continuación de soft break? Las propiedades vCard van en
  // MAYÚSCULAS antes del ':'; las continuaciones QP son texto codificado
  // mixed-case. Esto evita comernos END:VCARD (perder el contacto) o la
  // siguiente propiedad cuando un valor QP termina (mal) en '='.
  const isStructural = (l: string): boolean => {
    const up = l.toUpperCase();
    if (up === "BEGIN:VCARD" || up === "END:VCARD") return true;
    const m = l.match(/^([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)?)(?:;[^:]*)?:/);
    if (!m) return false;
    const namePart = m[1].split(".").pop() ?? m[1];
    return namePart === namePart.toUpperCase() && /[A-Z]/.test(namePart);
  };
  const lines: string[] = [];
  for (let i = 0; i < physical.length; i++) {
    let line = physical[i];
    if (/ENCODING=QUOTED-PRINTABLE/i.test(line)) {
      while (
        line.endsWith("=") &&
        i + 1 < physical.length &&
        !isStructural(physical[i + 1])
      ) {
        line = line.slice(0, -1) + physical[++i];
      }
    }
    lines.push(line);
  }

  const contacts: VCardContact[] = [];
  let current: VCardContact | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase() === "BEGIN:VCARD") {
      current = { name: "", phones: [], emails: [] };
      continue;
    }
    if (line.toUpperCase() === "END:VCARD") {
      if (current && (current.name || current.phones.length > 0 || current.emails.length > 0)) {
        contacts.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    // Separar nombre de propiedad (con sus parámetros) del valor.
    // Ej: TEL;TYPE=CELL:+5421156789012
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const propPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Quitar prefijo "groupX." de propiedades agrupadas (ej: item1.TEL:)
    const dotIdx = propPart.indexOf(".");
    const propClean = dotIdx >= 0 ? propPart.slice(dotIdx + 1) : propPart;

    // Separar nombre de propiedad y parámetros: "TEL;TYPE=CELL"
    const semiIdx = propClean.indexOf(";");
    const propName = (semiIdx >= 0 ? propClean.slice(0, semiIdx) : propClean).toUpperCase();
    const params = semiIdx >= 0 ? propClean.slice(semiIdx + 1).toUpperCase() : "";

    const decoded = decodeValue(value, params);

    switch (propName) {
      case "FN":
        if (!current.name) current.name = decoded;
        break;
      case "N":
        // Structured name: Apellido;Nombre;Medio;Prefijo;Sufijo
        if (!current.name) {
          const parts = decoded.split(";").map((p) => p.trim()).filter(Boolean);
          if (parts.length >= 2) {
            current.name = [parts[1], parts[2], parts[0]].filter(Boolean).join(" ");
          } else {
            current.name = parts.join(" ");
          }
        }
        break;
      case "TEL":
        if (decoded.trim()) current.phones.push(decoded.trim());
        break;
      case "EMAIL":
        if (decoded.trim()) current.emails.push(decoded.trim());
        break;
      case "NOTE":
        current.notes = (current.notes ? `${current.notes}\n` : "") + decoded;
        break;
      default:
        break;
    }
  }

  return contacts;
}

/** Decoder de un valor según los parámetros (encoding, charset). */
function decodeValue(value: string, params: string): string {
  let v = value;
  if (params.includes("QUOTED-PRINTABLE")) {
    v = decodeQuotedPrintable(v);
  }
  v = v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
  return v.trim();
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "=") {
      const hex = s.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
      // '=' huérfano (soft break residual o inválido): lo descartamos.
      i++;
      continue;
    }
    bytes.push(s.charCodeAt(i));
    i++;
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}
