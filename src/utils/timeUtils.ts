/**
 * timeUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilidades centralizadas para el manejo del tiempo en zona horaria Venezuela (UTC-4).
 *
 * Regla principal:
 *   "Hoy" empieza a las 12:00 AM Venezuela = 04:00 AM UTC
 *   "Hoy" termina justo antes de las 04:00 AM UTC del día siguiente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Offset de Venezuela en horas (UTC-4) */
export const VE_UTC_OFFSET_HOURS = 4;

/**
 * Retorna el inicio del "día Venezuela" actual como un Date en UTC.
 * 
 * Si son las 01:00 AM UTC (= 09:00 PM VE del día anterior),
 * aún cuenta como "el día anterior Venezuela", por lo que
 * retorna 4 AM UTC del día anterior.
 * 
 * Si son las 05:00 AM UTC (= 01:00 AM VE), retorna 4 AM UTC de HOY.
 */
export function getVenezuelaToday(now = new Date()): Date {
  const horaUTC = now.getUTCHours();
  const todayStart = new Date(now.getTime());

  if (horaUTC < VE_UTC_OFFSET_HOURS) {
    // Aún es "ayer" en Venezuela — retroceder al 04:00 UTC de ayer
    todayStart.setUTCDate(todayStart.getUTCDate() - 1);
  }
  todayStart.setUTCHours(VE_UTC_OFFSET_HOURS, 0, 0, 0);

  return todayStart;
}

/**
 * Retorna el inicio de la semana (Lunes) en horario Venezuela.
 * La semana empieza el Lunes a las 12 AM VE (= 4 AM UTC).
 */
export function getVenezuelaWeekStart(now = new Date()): Date {
  const todayStart = getVenezuelaToday(now);
  let dayOfWeek = todayStart.getUTCDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
  if (dayOfWeek === 0) dayOfWeek = 7; // Tratar Domingo como día 7

  const weekStart = new Date(todayStart.getTime());
  weekStart.setUTCDate(weekStart.getUTCDate() - (dayOfWeek - 1));
  return weekStart;
}

/**
 * Retorna el inicio del mes actual en horario Venezuela.
 * El mes empieza el día 1 a las 12 AM VE (= 4 AM UTC).
 */
export function getVenezuelaMonthStart(now = new Date()): Date {
  const todayStart = getVenezuelaToday(now);
  const monthStart = new Date(todayStart.getTime());
  monthStart.setUTCDate(1);
  return monthStart;
}

/**
 * Retorna el inicio del mes ANTERIOR en horario Venezuela.
 * Útil para calcular el snapshot del mes que acaba de terminar.
 */
export function getVenezuelaPrevMonthStart(now = new Date()): Date {
  const monthStart = getVenezuelaMonthStart(now);
  const prevMonth = new Date(monthStart.getTime());
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  return prevMonth;
}

/**
 * Retorna true si `date` está dentro del "día Venezuela" actual.
 */
export function isToday(date: Date | string, now = new Date()): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const todayStart = getVenezuelaToday(now);
  const tomorrowStart = new Date(todayStart.getTime());
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  return d >= todayStart && d < tomorrowStart;
}

/**
 * Retorna el año/mes Venezuela como string "YYYY-MM".
 * Usado como clave para snapshots mensuales.
 */
export function getVenezuelaYearMonth(now = new Date()): string {
  const todayStart = getVenezuelaToday(now);
  const year  = todayStart.getUTCFullYear();
  const month = String(todayStart.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Retorna el año/mes Venezuela del MES ANTERIOR como string "YYYY-MM".
 */
export function getPrevVenezuelaYearMonth(now = new Date()): string {
  const prevMonthStart = getVenezuelaPrevMonthStart(now);
  const year  = prevMonthStart.getUTCFullYear();
  const month = String(prevMonthStart.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Detecta si es exactamente el comienzo de un nuevo día Venezuela.
 * Se usa en el intervalo del Dashboard para saber cuándo resetear contadores.
 * 
 * Retorna true si la hora UTC actual es exactamente las 4:00 AM ± 1 minuto.
 */
export function isNewVenezuelaDay(now = new Date()): boolean {
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  return h === VE_UTC_OFFSET_HOURS && m === 0;
}

/**
 * Detecta si es el primer día del mes Venezuela (día 1).
 * Se usa junto con isNewVenezuelaDay para detectar el cambio de mes.
 */
export function isFirstDayOfVenezuelaMonth(now = new Date()): boolean {
  const todayStart = getVenezuelaToday(now);
  return todayStart.getUTCDate() === 1;
}
