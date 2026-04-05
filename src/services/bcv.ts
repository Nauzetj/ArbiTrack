import type { BCVRate } from "../types";

export const fetchBCVRate = async (): Promise<BCVRate> => {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
    const data = await res.json();
    return {
      fecha: new Date(data.fechaActualizacion).toISOString().split('T')[0],
      tasa_bcv: data.promedio,
      fuente: "auto"
    };
  } catch (error) {
    console.warn("Error con dolarapi, intentando pydolarve...", error);
    try {
      const resAlt = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv");
      const dataAlt = await resAlt.json();
      return {
        fecha: new Date().toISOString().split('T')[0],
        tasa_bcv: dataAlt.monedas.usd.valor,
        fuente: "auto"
      };
    } catch (errorAlt) {
      throw new Error("No se pudo obtener la tasa BCV automáticamente.");
    }
  }
};
