export const fetchP2POrders = async (
  apiKey: string,
  secretKey: string,
  page: number = 1,
  tradeType: string = ''
): Promise<any> => {
  // Sanitize keys - remove any whitespace
  const cleanApiKey = apiKey.trim();
  const cleanSecretKey = secretKey.trim();
  
  // Timeout de 15s en el cliente para que la UI nunca se quede colgada
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch('/api/binance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: cleanApiKey, secretKey: cleanSecretKey, page, tradeType }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error en Proxy Binance (${res.status})`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con Binance (15s)');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
