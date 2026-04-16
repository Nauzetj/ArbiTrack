// Helper para mostrar fecha en horario de Venezuela (UTC-4)
export const toLocalDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate.split('T')[0];
    
    // Venezuela es UTC-4
    const venezuelaOffset = -4; // horas
    const localTime = new Date(date.getTime() + (venezuelaOffset * 60 * 60 * 1000));
    
    // Formato: DD/MM/YYYY HH:mm
    const day = localTime.getDate().toString().padStart(2, '0');
    const month = (localTime.getMonth() + 1).toString().padStart(2, '0');
    const year = localTime.getFullYear();
    const hours = localTime.getHours().toString().padStart(2, '0');
    const minutes = localTime.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoDate.split('T')[0];
  }
};

// Para obtener solo la fecha (sin hora)
export const toLocalDateOnly = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate.split('T')[0];
    
    const venezuelaOffset = -4;
    const localTime = new Date(date.getTime() + (venezuelaOffset * 60 * 60 * 1000));
    
    const day = localTime.getDate().toString().padStart(2, '0');
    const month = (localTime.getMonth() + 1).toString().padStart(2, '0');
    const year = localTime.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return isoDate.split('T')[0];
  }
};