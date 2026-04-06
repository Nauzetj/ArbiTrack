import type { BCVRate } from "../types";

/** Timeout en ms para cada petición de tasa BCV */
const BCV_FETCH_TIMEOUT_MS = 8_000;

/** Crea una señal de abort con timeout automático */
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

/**
 * Obtiene la tasa oficial BCV desde dolarapi.com.
 * Si falla, intenta pydolarve.org como respaldo.
 * Lanza error solo si ambas fuentes fallan.
 */
export const fetchBCVRate = async (): Promise<BCVRate> => {
  // Fuente primaria
  try {
    const res = await fetchWithTimeout(
      "https://ve.dolarapi.com/v1/dolares/oficial",
      BCV_FETCH_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      fecha: new Date(data.fechaActualizacion).toISOString().split("T")[0],
      tasa_bcv: data.promedio,
      fuente: "auto",
    };
  } catch (error) {
    console.warn("dolarapi falló, intentando pydolarve...", error);
  }

  // Fuente de respaldo
  try {
    const res = await fetchWithTimeout(
      "https://pydolarve.org/api/v1/dollar?page=bcv",
      BCV_FETCH_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      fecha: new Date().toISOString().split("T")[0],
      tasa_bcv: data.monedas.usd.valor,
      fuente: "auto",
    };
  } catch (errorAlt) {
    throw new Error("No se pudo obtener la tasa BCV automáticamente.");
  }
};
