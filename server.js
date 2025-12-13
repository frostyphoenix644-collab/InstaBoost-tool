/**
 * Xinv4sionx Marketplace — Backend Server
 * Node + Express + Multer + JSON storage
 * Features: Auth, AI endpoint, Uploads (2 images), Hotlist, Availability, Static pages
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 2173;

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const DATA_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads dir exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ------------------------- Helpers -------------------------

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { users: [], products: [], sessions: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function nowISO() {
  return new Date().toISOString();
}

// Simple auth middleware (token-based)
function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const db = loadDB();
  const session = db.sessions.find(s => s.token === token);
  if (!session) return res.status(401).json({ error: 'Invalid token' });

  const user = db.users.find(u => u.id === session.userId);
  if (!user) return res.status(401).json({ error: 'Invalid user' });

  req.user = user;
  next();
}

// ------------------------- Multer for 2 images -------------------------

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const sellerId = req.user?.id || 'unknown';
    const dest = path.join(UPLOADS_DIR, 'sellers', sellerId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // Keep original name base but ensure uniqueness
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'image', ext).replace(/[^a-z0-9_-]/gi, '_');
    cb(null, base + '_' + Date.now() + ext);
  }
});

const uploader = multer({
  storage,
  limits: { files: 2, fileSize: 3 * 1024 * 1024 }, // 3MB per image
  fileFilter: (req, file, cb) => {
    const ok = ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file.originalname || '').toLowerCase());
    cb(ok ? null : new Error('Only images allowed (.png/.jpg/.jpeg/.webp)'));
  }
}).array('images', 2);

// ------------------------- Middleware -------------------------

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend & uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/', express.static(FRONTEND_DIR, { extensions: ['html'] }));

// ------------------------- AI Endpoint -------------------------
const { aiReply } = require('./ai_engine');

app.post('/api/ai', auth, (req, res) => {
  try {
    const db = loadDB();
    const { question, mode, role, sellerId } = req.body || {};
    const reply = aiReply({ question, mode, role, user: req.user, db, sellerId });
    res.json({ reply });
  } catch (e) {
    console.error('AI error', e);
    res.status(500).json({ reply: 'AI is unavailable right now.' });
  }
});

// ------------------------- Auth -------------------------

app.post('/api/signup', (req, res) => {
  const { phone, password, name, role, storeName, town } = req.body || {};
  if (!phone || !password || !name || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const db = loadDB();
  if (db.users.find(u => u.phone === phone)) {
    return res.status(400).json({ error: 'Phone already registered' });
  }
  const user = {
    id: uuidv4(),
    phone,
    password, // For demo only (no hashing here)
    name,
    role, // 'buyer' | 'seller'
    town: town || 'Nairobi',
    storeName: role === 'seller' ? (storeName || 'My Store') : null,
    availability: role === 'seller' ? { status: 'online', backAt: null } : null,
    createdAt: nowISO()
  };
  db.users.push(user);
  // Create session
  const token = uuidv4();
  db.sessions.push({ token, userId: user.id, createdAt: nowISO() });
  saveDB(db);
  res.json({ token, role: user.role, name: user.name, storeName: user.storeName });
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body || {};
  const db = loadDB();
  const user = db.users.find(u => u.phone === phone && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = uuidv4();
  db.sessions.push({ token, userId: user.id, createdAt: nowISO() });
  saveDB(db);
  res.json({ token, role: user.role, name: user.name, storeName: user.storeName });
});

app.get('/api/me', auth, (req, res) => {
  const user = req.user;
  res.json({ id: user.id, role: user.role, name: user.name, storeName: user.storeName, town: user.town, availability: user.availability });
});

// ------------------------- Seller Availability -------------------------

app.post('/api/seller/availability', auth, (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Not a seller' });
  const { status, backAt } = req.body || {};
  const db = loadDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.availability = {
    status: status || 'online',
    backAt: backAt || null
  };
  saveDB(db);
  res.json({ ok: true, availability: user.availability });
});

// ------------------------- Product Uploads (max 2 images) -------------------------

app.post('/api/seller/product', auth, (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Not a seller' });
  uploader(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    const { title, price, category, town, availableNow } = req.body || {};
    if (!title || !price || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const db = loadDB();
    const imgs = (req.files || []).map(f => {
      // Build web path
      const rel = f.path.split(path.sep).join('/');
      const idx = rel.lastIndexOf('/uploads/');
      return idx >= 0 ? rel.slice(idx) : '/uploads' + rel.split('/uploads')[1];
    });
    const product = {
      id: uuidv4(),
      sellerId: req.user.id,
      title: String(title).slice(0, 100),
      price: Number(price),
      category: String(category).slice(0, 50),
      town: town || req.user.town || 'Nairobi',
      availableNow: !!(availableNow === 'on' || availableNow === true || availableNow === 'true'),
      images: imgs.slice(0, 2),
      createdAt: nowISO()
    };
    db.products.unshift(product);
    saveDB(db);
    res.json({ ok: true, product });
  });
});

// ------------------------- Hotlist -------------------------

app.get('/api/hotlist', (req, res) => {
  const { town } = req.query || {};
  const db = loadDB();
  const list = db.products
    .filter(p => p.availableNow && (!town || p.town.toLowerCase() === String(town).toLowerCase()))
    .slice(0, 50);
  res.json({ items: list });
});

// ------------------------- Utility: Fallback routes -------------------------

app.get('/buyer', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'buyer_dashboard.html')));
app.get('/seller', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'seller_dashboard.html')));
app.get('/hotlist', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'hotlist.html')));
app.get('/product-manager', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'product_manager.html')));

app.listen(PORT, () => {
  console.log('Xinv4sionx Marketplace running on port', PORT);
});
