import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    const timestamp = Date.now();
    const rows = 100;

    let queryString = `timestamp=${timestamp}&page=${pageNum}&rows=${rows}`;
    if (tradeType) queryString += `&tradeType=${tradeType}`;

    console.log('[BINANCE PROXY] QueryString:', queryString);

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    console.log('[BINANCE PROXY] Signature长度:', signature.length);

    const fetchUrl = `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryString}&signature=${signature}`;

    const binanceRes = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': apiKey },
    });

    const data = await binanceRes.json();
    
    console.log(`[BINANCE PROXY] Status: ${binanceRes.status}`);
    console.log(`[BINANCE PROXY] Response:`, JSON.stringify(data).substring(0, 500));
    console.log(`[BINANCE PROXY] Payload length: ${data?.data?.length || 0}, Error Code: ${data?.code || 'none'}`);
    if (data?.data && data.data.length > 0) {
      console.log(`[BINANCE PROXY] First Order sample:`, JSON.stringify(data.data[0]).substring(0, 300));
    }

    if (!binanceRes.ok) {
      return res.status(binanceRes.status).json({ 
        error: data?.msg || `Binance error: ${binanceRes.status}`,
        code: data?.code,
        details: data
      });
    }

    return res.json(data);
  } catch (error: any) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
