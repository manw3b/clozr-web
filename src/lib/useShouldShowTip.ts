/**
 * Gate para el modal "¿Sabías que…?". Portado del desktop.
 * Reglas: máximo 1 vez por semana, solo en la primera llegada del día (por
 * sesión), silenciable permanente, con delay de 3s al entrar.
 */

import { useEffect, useState, useCallback } from "react";
import { pickFeatureTip, type FeatureTip } from "@/lib/clozrTips";

const LS_LAST_SHOWN = "clozr:tips:lastShown";
const LS_SEEN_IDS = "clozr:tips:seenIds";
const LS_SILENCED = "clozr:tips:silenced";
const LS_SESSION_DISMISSED = "clozr:tips:sessionDismissed"; // sessionStorage

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3000;

function readSeenIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_SEEN_IDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function shouldShow(): boolean {
  if (localStorage.getItem(LS_SILENCED) === "1") return false;
  try {
    if (sessionStorage.getItem(LS_SESSION_DISMISSED) === "1") return false;
  } catch {
    /* sessionStorage puede fallar en contextos locked-down */
  }
  const last = localStorage.getItem(LS_LAST_SHOWN);
  if (last) {
    const lastTs = Date.parse(last);
    if (!isNaN(lastTs) && Date.now() - lastTs < WEEK_MS) return false;
  }
  return true;
}

export function useShouldShowTip(enabled: boolean): {
  tip: FeatureTip | null;
  dismiss: () => void;
  silence: () => void;
} {
  const [tip, setTip] = useState<FeatureTip | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!shouldShow()) return;

    const handle = setTimeout(() => {
      if (!shouldShow()) return;
      const seen = readSeenIds();
      const picked = pickFeatureTip(seen);
      setTip(picked);
      try {
        localStorage.setItem(LS_LAST_SHOWN, new Date().toISOString());
        const newSeen = [...seen, picked.id].slice(-50);
        localStorage.setItem(LS_SEEN_IDS, JSON.stringify(newSeen));
      } catch {
        /* quota / disabled */
      }
    }, SHOW_DELAY_MS);

    return () => clearTimeout(handle);
  }, [enabled]);

  const dismiss = useCallback(() => {
    setTip(null);
    try {
      sessionStorage.setItem(LS_SESSION_DISMISSED, "1");
    } catch {
      /* */
    }
  }, []);

  const silence = useCallback(() => {
    setTip(null);
    try {
      localStorage.setItem(LS_SILENCED, "1");
      sessionStorage.setItem(LS_SESSION_DISMISSED, "1");
    } catch {
      /* */
    }
  }, []);

  return { tip, dismiss, silence };
}
