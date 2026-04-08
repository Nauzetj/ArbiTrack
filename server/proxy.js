import express from 'express';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
const port = 3001;

// ── CORRECCIÓN: CORS restrictivo ─────────────────────────────────────────────
// Antes: app.use(cors()) → cualquier origen podía llamar al proxy, exponiendo
// las API Keys de Binance que el cliente envía en el body.
// Ahora: solo se acepta el origen de la app propia.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.VITE_APP_ORIGIN,   // e.g. https://arbitrack.vercel.app
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origen (curl, Postman en desarrollo) solo en dev
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido → ${origin}`));
  },
  methods: ['POST'],
}));

app.use(express.json({ limit: '10kb' })); // Limitar tamaño del body

// ── CORRECCIÓN: Rate limiting in-process ─────────────────────────────────────
// Sin esto, el proxy podría ser abusado para agotar el rate limit de Binance
// de un usuario o hacer DDoS al proxy mismo.
// Para producción usa un rate limiter externo (Redis/Upstash) o el de Vercel.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto
const RATE_LIMIT_MAX = 20;           // máx 20 requests/min por IP

function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Wait 1 minute.' });
  }
  entry.count++;
  next();
}

// Limpiar entradas expiradas cada 5 min para no acumular memoria
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (val.resetAt < now) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// ── Endpoint principal ───────────────────────────────────────────────────────
app.post('/api/p2p-orders', rateLimit, async (req, res) => {
  try {
    const { apiKey, secretKey, page = 1, tradeType = '' } = req.body;

    if (!apiKey || !secretKey) {
      return res.status(401).json({ error: 'API Key and Secret Key required' });
    }

    // ── CORRECCIÓN: validación básica de parámetros ──────────────────────────
    // Antes no se validaba nada; un payload malicioso podría inyectar caracteres
    // en el queryString enviado a Binance.
    const pageNum = parseInt(String(page), 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > 500) {
      return res.status(400).json({ error: 'Parámetro "page" inválido.' });
    }
    if (tradeType && !['SELL', 'BUY', ''].includes(tradeType)) {
      return res.status(400).json({ error: 'Parámetro "tradeType" inválido.' });
    }

    const timestamp = Date.now();
    const rows = 10;

    let queryString = `timestamp=${timestamp}&page=${pageNum}&rows=${rows}`;
    if (tradeType) queryString += `&tradeType=${tradeType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    const fetchUrl = `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryString}&signature=${signature}`;

    const binanceRes = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': apiKey },
      signal: AbortSignal.timeout(15_000), // 15s timeout
    });

    const data = await binanceRes.json();
    if (!binanceRes.ok) {
      return res.status(binanceRes.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error?.message ?? error);
    res.status(500).json({ error: 'Internal server error' });
    // CORRECCIÓN: no exponer error.message al cliente (puede filtrar info interna)
  }
});

app.listen(port, '127.0.0.1', () => {
  // CORRECCIÓN: bind a 127.0.0.1, no a 0.0.0.0, para que el proxy no sea
  // accesible desde la red local de la máquina del operador.
  console.log(`ArbiTrack Proxy Server running on http://127.0.0.1:${port}`);
});