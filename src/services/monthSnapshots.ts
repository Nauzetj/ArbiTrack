/**
 * monthSnapshots.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Servicio para guardar y recuperar snapshots mensuales de ganancias.
 *
 * Un snapshot mensual se crea/actualiza automáticamente el primer día de cada
 * mes (a las 12 AM Venezuela = 4 AM UTC) con las métricas del mes anterior.
 *
 * Tabla requerida en Supabase: month_snapshots
 * Ver: create_month_snapshots.sql
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase';
import type { Cycle } from '../types';
import {
  getVenezuelaPrevMonthStart,
  getVenezuelaMonthStart,
  getPrevVenezuelaYearMonth,
} from '../utils/timeUtils';

export interface MonthSnapshot {
  id: string;
  userId: string;
  yearMonth: string;        // "2026-06"
  monthStart: string;       // ISO
  monthEnd: string;         // ISO
  totalCycles: number;
  profitUsdt: number;
  profitVes: number;
  volumeUsdt: number;
  createdAt: string;
  updatedAt: string;
}

function mapSnapshot(row: any): MonthSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    yearMonth: row.year_month,
    monthStart: row.month_start,
    monthEnd: row.month_end,
    totalCycles: Number(row.total_cycles),
    profitUsdt: Number(row.profit_usdt),
    profitVes: Number(row.profit_ves),
    volumeUsdt: Number(row.volume_usdt),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Guarda o actualiza el snapshot del MES ANTERIOR.
 * 
 * Calcula automáticamente qué ciclos pertenecen al mes anterior
 * basándose en su `closed_at` y genera el resumen.
 *
 * @param userId    - ID del usuario actual
 * @param allCycles - Todos los ciclos del usuario (del store)
 * @param now       - Fecha actual (injectable para tests, por defecto new Date())
 */
export async function saveMonthSnapshot(
  userId: string,
  allCycles: Cycle[],
  now = new Date()
): Promise<{ saved: boolean; yearMonth: string; snapshot: Partial<MonthSnapshot> }> {
  
  const yearMonth   = getPrevVenezuelaYearMonth(now);
  const monthStart  = getVenezuelaPrevMonthStart(now);
  const monthEnd    = getVenezuelaMonthStart(now); // = inicio del mes actual = fin del anterior

  // Filtrar ciclos completados que cerraron dentro del mes anterior
  const monthCycles = allCycles.filter(c => {
    if (!c.closedAt || c.status?.toLowerCase() === 'en curso') return false;
    const closed = new Date(c.closedAt);
    return closed >= monthStart && closed < monthEnd;
  });

  // Calcular métricas del mes
  const totalCycles = monthCycles.length;
  const profitUsdt  = monthCycles.reduce((sum, c) => sum + (c.ganancia_usdt ?? 0), 0);
  const profitVes   = monthCycles.reduce((sum, c) => sum + (c.ganancia_ves ?? 0), 0);
  
  // Volumen = suma de USDT vendido en ciclos del mes
  const volumeUsdt  = monthCycles.reduce((sum, c) => sum + (c.usdt_vendido ?? 0), 0);

  const payload = {
    user_id:      userId,
    year_month:   yearMonth,
    month_start:  monthStart.toISOString(),
    month_end:    monthEnd.toISOString(),
    total_cycles: totalCycles,
    profit_usdt:  profitUsdt,
    profit_ves:   profitVes,
    volume_usdt:  volumeUsdt,
    updated_at:   now.toISOString(),
  };

  console.log(`[MonthSnapshot] Guardando snapshot ${yearMonth}:`, {
    totalCycles,
    profitUsdt: profitUsdt.toFixed(4),
    profitVes: profitVes.toFixed(2),
    volumeUsdt: volumeUsdt.toFixed(4),
  });

  const { error } = await supabase
    .from('month_snapshots')
    .upsert(payload, { onConflict: 'user_id,year_month' });

  if (error) {
    console.error('[MonthSnapshot] Error guardando snapshot:', error);
    // Si la tabla no existe aún, no bloqueamos la app — solo logueamos
    if (error.code === '42P01') {
      console.warn('[MonthSnapshot] La tabla month_snapshots no existe. Ejecuta create_month_snapshots.sql en Supabase.');
    }
    // Retornar con las claves camelCase para respetar Partial<MonthSnapshot>
    return {
      saved: false,
      yearMonth,
      snapshot: { yearMonth, totalCycles, profitUsdt, profitVes, volumeUsdt } as Partial<MonthSnapshot>,
    };
  }

  console.log(`[MonthSnapshot] ✅ Snapshot ${yearMonth} guardado exitosamente.`);
  return {
    saved: true,
    yearMonth,
    snapshot: {
      yearMonth,
      totalCycles,
      profitUsdt,
      profitVes,
      volumeUsdt,
    } as Partial<MonthSnapshot>,
  };
}

/**
 * Recupera todos los snapshots mensuales de un usuario, ordenados por más reciente primero.
 */
export async function getMonthSnapshots(userId: string): Promise<MonthSnapshot[]> {
  const { data, error } = await supabase
    .from('month_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('year_month', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      console.warn('[MonthSnapshot] Tabla month_snapshots no existe todavía.');
      return [];
    }
    console.error('[MonthSnapshot] Error recuperando snapshots:', error);
    return [];
  }

  return (data ?? []).map(mapSnapshot);
}

/**
 * Recupera el snapshot de un mes específico.
 * @param userId    - ID del usuario
 * @param yearMonth - "2026-06"
 */
export async function getMonthSnapshot(
  userId: string,
  yearMonth: string
): Promise<MonthSnapshot | null> {
  const { data, error } = await supabase
    .from('month_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return mapSnapshot(data[0]);
}

/**
 * Verifica si ya existe un snapshot para el mes anterior.
 * Retorna true si el snapshot ya fue guardado (para no duplicar).
 */
export async function monthSnapshotExists(
  userId: string,
  yearMonth: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('month_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}
