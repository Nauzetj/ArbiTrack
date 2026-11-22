import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ─── CORS Headers ────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight (browsers send OPTIONS before POST)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { apiKey, secretKey, page = 1, tradeType = '' } = req.body;

    // Sanitize keys - remove any whitespace that may cause signature errors
    if (typeof apiKey === 'string') apiKey = apiKey.trim();
    if (typeof secretKey === 'string') secretKey = secretKey.trim();

    if (!apiKey || !secretKey) {
      return res.status(401).json({ error: 'API Key and Secret Key required' });
    }

    console.log('[BINANCE PROXY] API Key长度:', apiKey.length);
    console.log('[BINANCE PROXY] Secret Key长度:', secretKey.length);
    console.log('[BINANCE PROXY] Page:', page, 'TradeType:', tradeType);

    // Validar parámetros
    const pageNum = parseInt(String(page), 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > 500) {
      return res.status(400).json({ error: 'Parámetro "page" inválido.' });
    }
    if (tradeType && !['SELL', 'BUY', ''].includes(tradeType)) {
      return res.status(400).json({ error: 'Parámetro "tradeType" inválido.' });
    }

    // Restamos 1000ms al timestamp local para garantizar que NUNCA esté en el futuro
    // respecto a los servidores de Binance (evita permanentemente el error -1021)
    const timestamp = Date.now() - 1000;
    const rows = 100;

    // recvWindow=60000 es crítico para evitar error -1021 por latencia de red
    let queryString = `timestamp=${timestamp}&recvWindow=60000&page=${pageNum}&rows=${rows}`;
    if (tradeType) queryString += `&tradeType=${tradeType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    // Lista de dominios oficiales de Binance para tolerancia a fallos
    const binanceHosts = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com',
    ];

    let lastError: any = null;
    let data: any = null;
    let binanceRes: Response | null = null;

    // Intentar con el host principal, y si hay fallo de red/timeout, usar fallbacks oficiales
    for (const host of binanceHosts) {
      const fetchUrl = `${host}/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryString}&signature=${signature}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        binanceRes = await fetch(fetchUrl, {
          method: 'GET',
          headers: { 'X-MBX-APIKEY': apiKey },
          signal: controller.signal,
        });

        data = await binanceRes.json();
        lastError = null;
        break; // Éxito en conectar con Binance
      } catch (err: any) {
        lastError = err;
        console.warn(`[BINANCE PROXY] Falló host ${host}:`, err.message);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!binanceRes || lastError) {
      return res.status(504).json({
        error: lastError?.name === 'AbortError'
          ? 'Timeout: Binance no respondió en el tiempo límite.'
          : `Error de conexión con Binance: ${lastError?.message || 'Host no disponible'}`
      });
    }

    console.log(`[BINANCE PROXY] Status: ${binanceRes.status}`);
    console.log(`[BINANCE PROXY] Payload length: ${data?.data?.length ?? 0}, Code: ${data?.code ?? 'none'}`);

    // Si Binance devuelve error HTTP
    if (!binanceRes.ok) {
      return res.status(binanceRes.status).json({
        error: data?.msg || data?.message || `Binance HTTP ${binanceRes.status}`,
        code: data?.code,
        details: data,
      });
    }

    // Si Binance responde HTTP 200 pero con error en cuerpo (code !== '000000')
    if (data && data.code && data.code !== '000000') {
      return res.status(400).json({
        error: data.msg || data.message || `Binance C2C code: ${data.code}`,
        code: data.code,
        details: data,
      });
    }

    return res.json(data);
  } catch (error: any) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
