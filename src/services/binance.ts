export const fetchP2POrders = async (
  apiKey: string,
  secretKey: string,
  page: number = 1,
  tradeType: string = ''
): Promise<any> => {
  // Sanitize keys - remove any whitespace
  const cleanApiKey = apiKey.trim();
  const cleanSecretKey = secretKey.trim();
  
  // In production: /api/binance (Vercel Serverless Function)
  // In development: /api/binance (proxied by Vite to localhost)
  const res = await fetch('/api/binance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: cleanApiKey, secretKey: cleanSecretKey, page, tradeType }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Error en Proxy Binance: ${errData.error || res.statusText}`);
  }

  return await res.json();
};
