const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mlRouter = require("./ml");
const path = require('path');
const JsonStore = require('./store');
const AuthService = require('./auth');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
app.use(express.json());
app.use(cookieParser());

// ✅ Global CORS configuration (works for localhost + Render)
const corsOptions = {
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://comp4537projectclientside.onrender.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const store = new JsonStore(path.join(__dirname, '..', 'data', 'db.json'));
const auth = new AuthService(store, {
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  cookieSecure: false
});
auth.seedAdmin();

// ✅ Auth routes
const router = express.Router();

router.post('/auth/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const dto = auth.register(String(email).toLowerCase(), String(password));
    return res.status(200).json(dto);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { token, user } = auth.login(String(email).toLowerCase(), String(password));
    res.cookie(auth.cookieName, token, auth.cookieOptions());
    return res.status(200).json({ email: user.email, role: user.role, token });
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
});

router.get('/auth/me', (req, res) => {
  let token = req.cookies[auth.cookieName];
  const authz = req.headers.authorization || '';
  if (!token && authz.toLowerCase().startsWith('bearer ')) {
    token = authz.slice(7).trim();
  }
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const payload = auth.verify(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  const db = store.read();
  const user = db.users.find(u => u.id === payload.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  return res.status(200).json({ email: user.email, role: user.role, usage: user.usage });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie(auth.cookieName, auth.cookieOptions());
  return res.status(200).json({ ok: true });
});

// ✅ Mount routers
app.use("/api", router);
app.use("/api/ml", mlRouter);

// ✅ Catch-all for 404 (keeps CORS headers)
app.use((req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`✅ API listening on port ${PORT}/api`);
  console.log(`CORS allowed origins: ${corsOptions.origin.join(', ')}`);
});
