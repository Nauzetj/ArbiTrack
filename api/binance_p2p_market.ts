import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const fetchAd = async (tradeType: 'BUY' | 'SELL') => {
      const payload = {
        fiat: "VES",
        page: 1,
        rows: 5, // Traer el top 5 para mostrar profundidad de mercado
        tradeType: tradeType,
        asset: "USDT",
        countries: [],
        proMerchantAds: false,
        shieldMerchantAds: false,
        filterType: "all",
        periods: [],
        additionalKycVerifyFilter: 0,
        publisherType: null,
        payTypes: [],
        classifies: ["mass", "profession", "merchant"]
      };

      const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.code === '000000' && data.data && data.data.length > 0) {
        return data.data.map((item: any) => ({
          price: parseFloat(item.adv.price),
          volume: parseFloat(item.adv.tradableQuantity),
          advertiser: item.advertiser.nickName,
          minAmount: parseFloat(item.adv.minSingleTransAmount),
          maxAmount: parseFloat(item.adv.dynamicMaxSingleTransAmount)
        }));
      }
      return [];
    };

    const [buyAds, sellAds] = await Promise.all([
      fetchAd('BUY'),
      fetchAd('SELL')
    ]);

    if (!buyAds.length || !sellAds.length) {
      return res.status(500).json({ error: 'Failed to fetch P2P data' });
    }

    const topBuy = buyAds[0];
    const topSell = sellAds[0];

    return res.json({
      timestamp: Date.now(),
      topBuy: topBuy.price,
      topSell: topSell.price,
      spread: topSell.price - topBuy.price,
      buyVolume: topBuy.volume,
      sellVolume: topSell.volume,
      orderBook: {
        buy: buyAds,
        sell: sellAds
      }
    });

  } catch (error: any) {
    console.error('Binance P2P Market Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
