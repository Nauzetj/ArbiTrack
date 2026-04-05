import express from 'express';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/p2p-orders', async (req, res) => {
  try {
    const { apiKey, secretKey, page = 1 } = req.body;

    if (!apiKey || !secretKey) {
      return res.status(401).json({ error: 'API Key and Secret Key required' });
    }

    const timestamp = Date.now();
    const rows = 10;
    const tradeType = req.body.tradeType || ''; 

    // Build query string
    let queryString = `timestamp=${timestamp}&page=${page}&rows=${rows}`;
    if (tradeType) {
      queryString += `&tradeType=${tradeType}`;
    }

    // Sign request
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    const fetchUrl = `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryString}&signature=${signature}`;

    const binanceRes = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });

    const data = await binanceRes.json();
    
    if (!binanceRes.ok) {
       return res.status(binanceRes.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`ArbiTrack Proxy Server running on http://localhost:${port}`);
});
