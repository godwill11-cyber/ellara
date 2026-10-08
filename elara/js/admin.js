/* ELARA admin: overview, orders, products, site content. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const app = $('#app');
  const KEY = 'elara_admin';
  let token = localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || '';
  let tab = 'overview', products = [], orders = [], content = {}, editing = null;

  const call = async (path, method = 'GET', body) => {
    const r = await fetch('/api/admin' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && token) { signOut(); throw new Error('Please sign in again'); }
    if (!r.ok) throw new Error(d.error || 'Something went wrong');
    return d;
  };
  const signOut = () => { token = ''; localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); gate(); };
  const msg = (t, bad) => { const m = $('#msg'); if (m) { m.className = bad ? 'bad' : 'ok'; m.textContent = t; } };
  const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const upload = async f => (await call('/upload', 'POST', { data: await readFile(f), filename: f.name })).url;

  function gate(err = '') {
    app.innerHTML = `<form class="gate" id="login"><p class="logo">ELARA</p><h1>Store management</h1>
      <label>Password<input type="password" name="password" autocomplete="current-password" autofocus required></label>
      <label class="opt" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="remember"> Keep me signed in for 30 days</label>
      <p class="bad" role="alert">${esc(err)}</p><button class="btn btn-dark">Sign in</button></form>`;
    $('#login').onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: f.password, remember: !!f.remember }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        token = d.token; (f.remember ? localStorage : sessionStorage).setItem(KEY, token); start();
      } catch (x) { gate(x.message || 'Could not sign in'); }
    };
  }

  const shell = body => {
    const nav = [['overview', 'Overview'], ['orders', 'Orders'], ['products', 'Products'], ['content', 'Site content']];
    const n = orders.filter(o => o.status === 'new').length;
    app.innerHTML = `<div class="shell"><aside class="side"><p class="logo">ELARA</p>
      ${nav.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'orders' && n ? ` <span class="count">${n}</span>` : ''}</button>`).join('')}
      <a class="btn-sm" href="/" target="_blank" style="margin-top:12px;text-align:center">View store</a><button class="out" id="out">Sign out</button></aside>
      <div class="main">${body}</div></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; editing = null; render(); });
    $('#out').onclick = signOut;
  };

  const views = {
    async overview() {
      const s = await call('/stats');
      shell(`<h1>Overview</h1><div class="stats">
        <div class="stat"><b>${s.visitors}</b><span>Unique visitors</span></div><div class="stat"><b>${s.pageViews}</b><span>Visits</span></div>
        <div class="stat"><b>${s.orders}</b><span>Orders (${s.newOrders} new)</span></div><div class="stat"><b>${money(s.revenue)}</b><span>Sales</span></div></div>
        <p class="muted" style="margin-top:24px">Visitors are counted from a salted hash of the IP address. The address itself is never stored.</p>`);
    },
    orders() {
      shell(`<h1>Orders</h1>${orders.length ? `<div class="tw"><table><tr><th>No.</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
        ${orders.map(o => `<tr><td>#${o.order_no}</td><td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td>${esc(o.shipping?.name)}<br><span class="muted">${esc(o.email)}${o.shipping?.phone ? ' · ' + esc(o.shipping.phone) : ''}</span><br><span class="muted">${esc([o.shipping?.address, o.shipping?.city, o.shipping?.country].filter(Boolean).join(', '))}</span></td>
          <td>${(o.items || []).map(i => `${i.qty} × ${esc(i.name)}${i.color ? ' (' + esc(i.color) + ')' : ''}`).join('<br>')}</td>
          <td>${money(o.total)}<br><span class="muted">${esc(o.delivery)}</span></td>
          <td><select data-order="${o.id}">${['new', 'packed', 'shipped', 'delivered', 'cancelled'].map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</table></div>` : '<p class="muted">No orders yet.</p>'}<p id="msg"></p>`);
      $$('[data-order]').forEach(s => s.onchange = async () => {
        try { await call('/orders/' + s.dataset.order, 'PATCH', { status: s.value }); orders.find(o => o.id === s.dataset.order).status = s.value; msg('Order updated'); }
        catch (e) { msg(e.message, true); }
      });
    },
    products() {
      const p = editing;
      const list = `<div class="tw"><table><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr>
        ${products.map(x => `<tr><td><div class="pc">${x.images?.[0] ? `<img src="${esc(x.images[0])}" alt="">` : '<div class="ph"></div>'}<div>${esc(x.name)}<br><span class="muted">${esc(x.category)}</span></div></div></td>
        <td>${money(x.price)}</td><td class="${x.stock < 4 ? 'bad' : ''}">${x.stock}</td><td>${x.status}</td><td><button class="btn-sm" data-edit="${x.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No products yet.</td></tr>'}</table></div>`;
      const form = p ? `<form class="panel" id="pform"><h2>${p.id ? 'Edit product' : 'New product'}</h2>
        <label class="f">Name<input name="name" required value="${esc(p.name)}"></label>
        <div class="r2"><label class="f">Category<input name="category" list="cats" value="${esc(p.category || 'Cabin')}"><datalist id="cats"><option>Cabin<option>Check-in<option>Sets<option>Accessories</datalist></label>
        <label class="f">Status<select name="status"><option value="published" ${p.status !== 'draft' ? 'selected' : ''}>Published</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft (hidden)</option></select></label></div>
        <div class="r2"><label class="f">Price (USD)<input name="price" type="number" min="0" step="0.01" required value="${p.price ?? ''}"></label><label class="f">Stock<input name="stock" type="number" min="0" step="1" required value="${p.stock ?? 0}"></label></div>
        <div class="r2"><label class="f">Colours (comma separated)<input name="colors" value="${esc((p.colors || []).join(', '))}"></label><label class="f">Sizes (comma separated)<input name="sizes" value="${esc((p.sizes || []).join(', '))}"></label></div>
        <label class="f">Description<textarea name="description">${esc(p.description || '')}</textarea></label>
        <p class="h4">Photos (the first is the cover)</p>
        <div class="photos">${(p.images || []).map((u, i) => `<div class="ph1"><img src="${esc(u)}" alt=""><div><button type="button" data-mv="${i}:-1">←</button><button type="button" data-mv="${i}:1">→</button><button type="button" data-rmimg="${i}">✕</button></div></div>`).join('')}</div>
        <label class="f">Add photos<input type="file" id="files" accept="image/png,image/jpeg,image/webp" multiple></label>
        <div class="acts"><button class="btn btn-dark" type="submit">Save product</button><button class="btn-sm" type="button" id="cancel">Cancel</button>
          ${p.id ? '<button class="btn-sm btn-danger" type="button" id="del">Delete</button>' : ''}<span id="msg"></span></div></form>` : '';
      shell(`<h1>Products</h1><div class="acts" style="margin:0 0 20px"><button class="btn btn-dark" id="new">Add product</button><span id="msg"></span></div><div class="layout"><div>${list}</div><div>${form}</div></div>`);
      $('#new').onclick = () => { editing = { images: [], status: 'published', category: 'Cabin', stock: 0 }; render(); };
      $$('[data-edit]').forEach(b => b.onclick = () => { editing = JSON.parse(JSON.stringify(products.find(x => x.id === b.dataset.edit))); render(); });
      if (!p) return;
      const sync = () => { const f = Object.fromEntries(new FormData($('#pform'))); Object.assign(editing, { name: f.name, category: f.category, status: f.status, price: f.price, stock: f.stock, description: f.description, colors: f.colors.split(',').map(s => s.trim()).filter(Boolean), sizes: f.sizes.split(',').map(s => s.trim()).filter(Boolean) }); };
      $('#cancel').onclick = () => { editing = null; render(); };
      $('#files').onchange = async e => {
        sync(); msg('Uploading…');
        try { for (const f of e.target.files) editing.images.push(await upload(f)); render(); } catch (x) { msg(x.message, true); }
      };
      $$('[data-rmimg]').forEach(b => b.onclick = () => { sync(); editing.images.splice(+b.dataset.rmimg, 1); render(); });
      $$('[data-mv]').forEach(b => b.onclick = () => { sync(); const [i, d] = b.dataset.mv.split(':').map(Number), j = i + d, a = editing.images; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; render(); });
      if ($('#del')) $('#del').onclick = async () => { if (!confirm('Delete this product for good?')) return; try { await call('/products/' + p.id, 'DELETE'); editing = null; await load(); render(); } catch (x) { msg(x.message, true); } };
      $('#pform').onsubmit = async e => {
        e.preventDefault(); sync(); msg('Saving…');
        try { await call('/products', 'POST', editing); editing = null; await load(); render(); msg('Saved'); } catch (x) { msg(x.message, true); }
      };
    },
    content() {
      const D = window.DEFAULTS, keys = Object.keys(D), groups = {};
      keys.forEach(k => (groups[k.split('.')[0]] ||= []).push(k));
      const val = k => content[k] ?? D[k];
      const field = k => /\.image$/.test(k)
        ? `<div class="f"><span>${k}</span><div class="imgf"><img src="${esc(val(k))}" alt=""><input type="text" data-k="${k}" value="${esc(val(k))}"><input type="file" data-up="${k}" accept="image/png,image/jpeg,image/webp" style="width:auto"></div></div>`
        : `<label class="f">${k}${val(k).length > 70 ? `<textarea data-k="${k}">${esc(val(k))}</textarea>` : `<input type="text" data-k="${k}" value="${esc(val(k))}">`}</label>`;
      shell(`<h1>Site content</h1><p class="muted">Change any text or photo on the storefront. Empty a field to hide that text.</p>
        ${Object.entries(groups).map(([g, ks]) => `<p class="grp">${g}</p>${ks.map(field).join('')}`).join('')}
        <div class="acts"><button class="btn btn-dark" id="save">Save changes</button><span id="msg"></span></div>`);
      $$('[data-up]').forEach(i => i.onchange = async () => {
        try { msg('Uploading…'); const u = await upload(i.files[0]); $(`[data-k="${i.dataset.up}"]`).value = u; i.parentNode.querySelector('img').src = u; msg('Photo uploaded. Press Save changes.'); } catch (x) { msg(x.message, true); }
      });
      $('#save').onclick = async () => {
        const body = {}; $$('[data-k]').forEach(i => body[i.dataset.k] = i.value);
        try { await call('/content', 'PUT', body); Object.assign(content, body); msg('Saved. The store is updated.'); } catch (x) { msg(x.message, true); }
      };
    }
  };

  async function load() {
    [products, orders] = await Promise.all([call('/products'), call('/orders')]);
    content = await fetch('/api/content').then(r => r.json()).catch(() => ({}));
  }
  async function render() { try { await views[tab](); } catch (e) { if (token) shell(`<h1>Something went wrong</h1><p class="bad">${esc(e.message)}</p>`); } }
  async function start() {
    if (!token) return gate();
    try { await load(); render(); } catch (e) { if (token) app.innerHTML = `<p class="boot bad">${esc(e.message)}</p>`; }
  }
  start();
})();
