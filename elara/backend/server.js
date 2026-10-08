require('dotenv').config();
const express = require('express'), crypto = require('crypto'), path = require('path'), jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const { PORT = 3000, SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD, JWT_SECRET, IP_SALT = 'elara' } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('Missing .env values. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '14mb' }));

const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: e.message || 'Server error' }); });
const ok = r => { if (r.error) throw r.error; return r.data; };
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const auth = (req, res, next) => {
  try { jwt.verify((req.headers.authorization || '').slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in again' }); }
};
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Public API ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Visitor ID: salted hash of the IP. The raw IP is never stored.
app.get('/api/visitor', wrap(async (req, res) => {
  const id = 'v_' + crypto.createHash('sha256').update(req.ip + IP_SALT).digest('hex').slice(0, 12);
  const row = ok(await db.from('visitors').select('visits').eq('id', id).maybeSingle());
  if (row) ok(await db.from('visitors').update({ visits: row.visits + 1, last_seen: new Date().toISOString() }).eq('id', id));
  else ok(await db.from('visitors').insert({ id }));
  res.json({ id });
}));

app.get('/api/content', wrap(async (req, res) => {
  res.json(Object.fromEntries(ok(await db.from('site_content').select('*')).map(r => [r.key, r.value])));
}));

app.get('/api/products', wrap(async (req, res) => {
  res.json(ok(await db.from('products').select('*').eq('status', 'published').order('created_at')));
}));

app.post('/api/orders', wrap(async (req, res) => {
  const { email, shipping, items, delivery = 'standard', visitor_id = null } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '') || !shipping?.name || !shipping?.address || !shipping?.city || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Please fill in your email and delivery address.' });
  const prods = ok(await db.from('products').select('*').eq('status', 'published').in('slug', items.map(i => i.slug)));
  let subtotal = 0;
  const need = {};
  const lines = items.map(i => {
    const p = prods.find(x => x.slug === i.slug);
    if (!p) throw new Error('A product in your bag is no longer available.');
    const qty = Math.max(1, Math.min(10, parseInt(i.qty) || 1));
    need[p.slug] = (need[p.slug] || 0) + qty;
    if (p.stock < need[p.slug]) throw new Error(p.name + ' is low on stock (' + p.stock + ' left).');
    subtotal += Number(p.price) * qty;
    return { slug: p.slug, name: p.name, price: Number(p.price), qty, color: i.color || null, size: i.size || null };
  });
  const shipping_cost = delivery === 'express' ? 25 : (subtotal >= 150 ? 0 : 9);
  const tax = +(subtotal * 0.08).toFixed(2);
  const total = +(subtotal + shipping_cost + tax).toFixed(2);
  const order = ok(await db.from('orders').insert({ email, shipping, items: lines, subtotal, shipping_cost, tax, total, delivery, visitor_id }).select().single());
  for (const slug of Object.keys(need)) {
    const p = prods.find(x => x.slug === slug);
    await db.from('products').update({ stock: Math.max(0, p.stock - need[slug]) }).eq('id', p.id);
  }
  res.json({ order_no: order.order_no, total });
}));

// ---------- Admin API ----------
app.post('/api/admin/login', (req, res) => {
  if (!same(req.body?.password || '', ADMIN_PASSWORD)) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: req.body.remember ? '30d' : '12h' }) });
});

const A = express.Router();
A.use(auth);
A.get('/stats', wrap(async (req, res) => {
  const v = ok(await db.from('visitors').select('visits'));
  const o = ok(await db.from('orders').select('total,status'));
  res.json({
    visitors: v.length, pageViews: v.reduce((a, b) => a + b.visits, 0),
    orders: o.length, newOrders: o.filter(x => x.status === 'new').length,
    revenue: o.filter(x => x.status !== 'cancelled').reduce((a, b) => a + Number(b.total), 0)
  });
}));
A.get('/orders', wrap(async (req, res) => res.json(ok(await db.from('orders').select('*').order('created_at', { ascending: false })))));
A.patch('/orders/:id', wrap(async (req, res) => {
  if (!['new', 'packed', 'shipped', 'delivered', 'cancelled'].includes(req.body.status)) return res.status(400).json({ error: 'Bad status' });
  res.json(ok(await db.from('orders').update({ status: req.body.status }).eq('id', req.params.id).select().single()));
}));
A.get('/products', wrap(async (req, res) => res.json(ok(await db.from('products').select('*').order('created_at')))));
A.post('/products', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Name is required' });
  const row = {
    slug: b.slug || slugify(b.name), name: b.name, category: b.category || 'Cabin',
    price: Math.max(0, Number(b.price) || 0), stock: Math.max(0, parseInt(b.stock) || 0),
    colors: b.colors || [], sizes: b.sizes || [], images: b.images || [],
    description: b.description || '', status: b.status === 'draft' ? 'draft' : 'published'
  };
  if (b.id) row.id = b.id;
  res.json(ok(await db.from('products').upsert(row, { onConflict: b.id ? 'id' : 'slug' }).select().single()));
}));
A.delete('/products/:id', wrap(async (req, res) => { ok(await db.from('products').delete().eq('id', req.params.id)); res.json({ ok: true }); }));
A.post('/upload', wrap(async (req, res) => {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(req.body.data || '');
  if (!m) return res.status(400).json({ error: 'Use a JPG, PNG or WEBP image' });
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Max 10 MB per photo' });
  const name = Date.now() + '-' + String(req.body.filename || 'photo').replace(/[^\w.]/g, '_');
  ok(await db.storage.from('products').upload(name, buf, { contentType: m[1] }));
  res.json({ url: db.storage.from('products').getPublicUrl(name).data.publicUrl });
}));
A.put('/content', wrap(async (req, res) => {
  const rows = Object.entries(req.body || {}).map(([key, value]) => ({ key, value: String(value) }));
  if (rows.length) ok(await db.from('site_content').upsert(rows));
  res.json({ ok: true });
}));
app.use('/api/admin', A);

// ---------- Website ----------
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));
app.listen(PORT, () => console.log('ELARA running on http://localhost:' + PORT));
