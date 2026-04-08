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
    const { apiKey, secretKey, page = 1, tradeType = '' } = req.body;

    if (!apiKey || !secretKey) {
      return res.status(401).json({ error: 'API Key and Secret Key required' });
    }

    const timestamp = Date.now();
    const rows = 100;

    let queryString = `timestamp=${timestamp}&page=${page}&rows=${rows}`;
    if (tradeType) queryString += `&tradeType=${tradeType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    const fetchUrl = `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryString}&signature=${signature}`;

    const binanceRes = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': apiKey },
    });

    const data = await binanceRes.json();
    
    console.log(`[BINANCE PROXY] Status: ${binanceRes.status}`);
    console.log(`[BINANCE PROXY] Payload length: ${data?.data?.length || 0}, Error Code: ${data?.code || 'none'}`);
    if (data?.data && data.data.length > 0) {
      console.log(`[BINANCE PROXY] First Order sample:`, JSON.stringify(data.data[0]).substring(0, 300));
    }

    if (!binanceRes.ok) {
      return res.status(binanceRes.status).json(data);
    }

    return res.json(data);
  } catch (error: any) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
