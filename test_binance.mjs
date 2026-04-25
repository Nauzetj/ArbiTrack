fetch('https://api.binance.com/api/v3/klines?symbol=USDTVES&interval=1h&limit=5').then(r=>r.json()).then(console.log).catch(console.error);
