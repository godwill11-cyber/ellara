/* ELARA storefront: header, footer, home, shop, product page, bag and checkout. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const api = async (url, opt) => {
    const r = await fetch(url, opt);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
    return d;
  };
  const store = {
    get: (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // ----- bag -----
  const bag = {
    all: () => store.get('elara_bag', []),
    save: l => { store.set('elara_bag', l); count(); },
    add(item) {
      const l = bag.all(), key = i => [i.slug, i.color, i.size].join('|');
      const f = l.find(i => key(i) === key(item));
      f ? f.qty = Math.min(10, f.qty + item.qty) : l.push(item);
      bag.save(l);
    }
  };
  const count = () => { const n = bag.all().reduce((a, i) => a + i.qty, 0); const el = $('#bag-count'); if (el) { el.textContent = n; el.hidden = !n; } };

  // ----- site content (defaults + whatever the admin saved) -----
  let C = { ...window.DEFAULTS };
  const paint = () => {
    $$('[data-c]').forEach(e => e.textContent = C[e.dataset.c] ?? '');
    $$('[data-c-src]').forEach(e => e.src = C[e.dataset.cSrc] || '');
    $$('[data-c-bg]').forEach(e => e.style.backgroundImage = `url("${C[e.dataset.cBg] || ''}")`);
  };
  const shell = () => {
    $('#site-header').innerHTML = `<header class="hdr"><div class="wrap hdr-in">
      <a class="logo" href="index.html">ELARA</a>
      <nav><a href="shop.html">Shop</a><a href="index.html#journal">Journal</a></nav>
      <a class="bag-link" href="checkout.html" aria-label="Open your bag">Bag <span id="bag-count" class="count" hidden>0</span></a></div></header>`;
    $('#site-footer').innerHTML = `<footer class="ftr"><div class="wrap ftr-in">
      <div><a class="logo" href="index.html">ELARA</a><p data-c="footer.text"></p></div>
      <div><p class="h4">Shop</p><a href="shop.html?cat=Cabin">Cabin</a><a href="shop.html?cat=Check-in">Check-in</a><a href="shop.html?cat=Sets">Sets</a><a href="shop.html?cat=Accessories">Accessories</a></div>
      <div><p class="h4">Contact</p><p data-c="footer.email"></p><p data-c="footer.location"></p></div></div></footer>`;
    count();
  };
  const card = p => `<a class="pcard" href="product.html?slug=${encodeURIComponent(p.slug)}">
    <div class="pimg">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">` : ''}${p.stock < 1 ? '<span class="tag">Sold out</span>' : ''}</div>
    <div class="pinfo"><div><p class="pname">${esc(p.name)}</p><p class="muted">${esc(p.category)}${p.colors?.length ? ' · ' + esc(p.colors.join(', ')) : ''}</p></div><p>${money(p.price)}</p></div></a>`;
  const products = () => api('/api/products');
  const page = document.body.dataset.page;

  // ----- pages -----
  const pages = {
    async home() {
      $('#perks').innerHTML = [1, 2, 3].map(n => `<div><p class="h3" data-c="perk.${n}.title"></p><p class="muted" data-c="perk.${n}.text"></p></div>`).join('');
      $('#tiles').innerHTML = [1, 2, 3].map(n => `<a class="tile" href="shop.html?cat=${encodeURIComponent(C['tile.' + n + '.cat'])}"><div data-c-bg="tile.${n}.image"></div><span class="glass"><b data-c="tile.${n}.title"></b><small data-c="tile.${n}.text"></small></span></a>`).join('');
      $('#stories').innerHTML = [1, 2, 3].map(n => `<article class="story"><img data-c-src="story.${n}.image" alt=""><p class="h3" data-c="story.${n}.title"></p><p class="muted" data-c="story.${n}.text"></p></article>`).join('');
      try { $('#featured').innerHTML = (await products()).slice(0, 3).map(card).join('') || '<p class="muted">Products will appear here soon.</p>'; }
      catch (e) { $('#featured').innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    },
    async shop() {
      let list = [];
      try { list = await products(); } catch (e) { $('#grid').innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
      let cat = new URLSearchParams(location.search).get('cat') || 'All';
      const cats = ['All', ...new Set(list.map(p => p.category))];
      const draw = () => {
        $('#cats').innerHTML = cats.map(c => `<button type="button" class="chip${c === cat ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
        let v = list.filter(p => cat === 'All' || p.category === cat);
        const s = $('#sort').value;
        v.sort(s === 'low' ? (a, b) => a.price - b.price : s === 'high' ? (a, b) => b.price - a.price : s === 'name' ? (a, b) => a.name.localeCompare(b.name) : () => 0);
        $('#result').textContent = v.length + (v.length === 1 ? ' product' : ' products');
        $('#grid').innerHTML = v.map(card).join('') || '<p class="muted">Nothing here yet. Try another category.</p>';
      };
      $('#cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; draw(); } };
      $('#sort').onchange = draw;
      draw();
    },
    async product() {
      const slug = new URLSearchParams(location.search).get('slug'), el = $('#product');
      let p;
      try { p = (await products()).find(x => x.slug === slug); } catch (e) { el.innerHTML = `<div class="wrap"><p class="muted">${esc(e.message)}</p></div>`; return; }
      if (!p) { el.innerHTML = '<div class="wrap pad"><h1>Product not found</h1><p><a class="link" href="shop.html">Back to the shop</a></p></div>'; return; }
      document.title = p.name + ' · ELARA';
      const imgs = p.images?.length ? p.images : [''];
      let color = p.colors?.[0] || null, size = p.sizes?.[0] || null, qty = 1;
      const chips = (arr, on, k) => arr?.length ? `<div class="chips">${arr.map(v => `<button type="button" class="chip${v === on ? ' on' : ''}" data-${k}="${esc(v)}">${esc(v)}</button>`).join('')}</div>` : '';
      const draw = () => {
        el.innerHTML = `<div class="wrap pdp">
          <div class="gallery"><div class="main"><img id="main-img" src="${esc(imgs[0])}" alt="${esc(p.name)}"></div>
            ${imgs.length > 1 ? `<div class="thumbs">${imgs.map(u => `<button type="button" data-img="${esc(u)}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}</div>
          <div class="pbuy"><p class="eyebrow">${esc(p.category)}</p><h1>${esc(p.name)}</h1><p class="price">${money(p.price)}</p>
            <p class="desc">${esc(p.description)}</p>
            ${p.colors?.length ? `<p class="h4">Colour: ${esc(color)}</p>${chips(p.colors, color, 'color')}` : ''}
            ${p.sizes?.length ? `<p class="h4">Size: ${esc(size)}</p>${chips(p.sizes, size, 'size')}` : ''}
            <div class="buyrow"><div class="qty"><button type="button" id="minus" aria-label="Fewer">−</button><span>${qty}</span><button type="button" id="plus" aria-label="More">+</button></div>
              <button class="btn btn-dark grow" id="add" type="button" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Sold out' : 'Add to bag'}</button></div>
            <p class="muted fine" id="msg">${p.stock > 0 && p.stock <= 5 ? 'Only ' + p.stock + ' left.' : p.stock > 5 ? 'In stock. Free shipping over $150.' : ''}</p></div></div>`;
      };
      draw();
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.img) { $('#main-img').src = t.dataset.img; return; }
        if (t.dataset.color) { color = t.dataset.color; draw(); }
        else if (t.dataset.size) { size = t.dataset.size; draw(); }
        else if (t.id === 'minus') { qty = Math.max(1, qty - 1); draw(); }
        else if (t.id === 'plus') { qty = Math.min(Math.min(10, p.stock), qty + 1); draw(); }
        else if (t.id === 'add') {
          bag.add({ slug: p.slug, color, size, qty });
          $('#msg').innerHTML = 'Added to your bag. <a class="link" href="checkout.html">View bag</a>';
        }
      };
    },
    async checkout() {
      const el = $('#checkout'), me = store.get('elara_me', {});
      let list = [];
      try { list = await products(); } catch {}
      let delivery = 'standard';
      const lines = () => bag.all().map(i => ({ ...i, p: list.find(p => p.slug === i.slug) })).filter(i => i.p);
      const totals = () => {
        const sub = lines().reduce((a, i) => a + i.p.price * i.qty, 0);
        const ship = !sub ? 0 : delivery === 'express' ? 25 : sub >= 150 ? 0 : 9, tax = +(sub * 0.08).toFixed(2);
        return { sub, ship, tax, total: +(sub + ship + tax).toFixed(2) };
      };
      const draw = () => {
        const L = lines(), t = totals();
        if (!L.length) { el.innerHTML = '<div class="empty"><h1 data-c="checkout.title"></h1><p class="muted">Your bag is empty.</p><a class="btn btn-dark" href="shop.html">Shop the collection</a></div>'; paint(); return; }
        el.innerHTML = `<div class="co"><div><h1 data-c="checkout.title"></h1>
          <div class="lines">${L.map((i, n) => `<div class="line"><img src="${esc(i.p.images?.[0] || '')}" alt=""><div class="grow"><p class="pname">${esc(i.p.name)}</p><p class="muted">${esc([i.color, i.size].filter(Boolean).join(' · '))}</p>
            <div class="qty sm"><button type="button" data-dec="${n}" aria-label="Fewer">−</button><span>${i.qty}</span><button type="button" data-inc="${n}" aria-label="More">+</button><button type="button" class="link fine" data-rm="${n}">Remove</button></div></div><p>${money(i.p.price * i.qty)}</p></div>`).join('')}</div>
          <img class="co-img" data-c-src="checkout.image" alt=""></div>
          <form id="form" class="panel" novalidate><h2>Delivery details</h2>
            <label>Email<input name="email" type="email" required autocomplete="email" value="${esc(me.email)}"></label>
            <label>Full name<input name="name" required autocomplete="name" value="${esc(me.name)}"></label>
            <label>Phone<input name="phone" type="tel" autocomplete="tel" value="${esc(me.phone)}"></label>
            <label>Address<input name="address" required autocomplete="street-address" value="${esc(me.address)}"></label>
            <div class="two"><label>City<input name="city" required autocomplete="address-level2" value="${esc(me.city)}"></label><label>Country<input name="country" autocomplete="country-name" value="${esc(me.country)}"></label></div>
            <fieldset><legend class="h4">Delivery</legend>
              <label class="opt"><input type="radio" name="delivery" value="standard" ${delivery === 'standard' ? 'checked' : ''}> Standard · ${t.sub >= 150 ? 'Free' : '$9'}</label>
              <label class="opt"><input type="radio" name="delivery" value="express" ${delivery === 'express' ? 'checked' : ''}> Express · $25</label></fieldset>
            <div class="sum"><p><span>Subtotal</span><span>${money(t.sub)}</span></p><p><span>Shipping</span><span>${t.ship ? money(t.ship) : 'Free'}</span></p><p><span>Tax (8%)</span><span>${money(t.tax)}</span></p><p class="tot"><span>Total</span><span>${money(t.total)}</span></p></div>
            <label class="opt"><input type="checkbox" name="remember" checked> Remember my details on this device</label>
            <p class="muted fine" data-c="checkout.note"></p>
            <p class="err" id="err" role="alert"></p>
            <button class="btn btn-dark" id="place" type="submit">Place order</button></form></div>`;
        paint();
      };
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const l = bag.all(), L = lines();
        const idx = k => l.findIndex(x => x.slug === L[b.dataset[k]].slug && x.color === L[b.dataset[k]].color && x.size === L[b.dataset[k]].size);
        if (b.dataset.inc != null) { const i = idx('inc'); l[i].qty = Math.min(10, l[i].qty + 1); }
        else if (b.dataset.dec != null) { const i = idx('dec'); l[i].qty = Math.max(1, l[i].qty - 1); }
        else if (b.dataset.rm != null) l.splice(idx('rm'), 1);
        else return;
        bag.save(l); draw();
      });
      el.addEventListener('change', e => { if (e.target.name === 'delivery') { const f = new FormData($('#form')); delivery = e.target.value; Object.assign(me, Object.fromEntries(f)); draw(); } });
      el.addEventListener('submit', async e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target)), err = $('#err'), btn = $('#place');
        err.textContent = '';
        if (!/^\S+@\S+\.\S+$/.test(f.email) || !f.name.trim() || !f.address.trim() || !f.city.trim()) { err.textContent = 'Please fill in your email, name, address and city.'; return; }
        btn.disabled = true; btn.textContent = 'Placing order…';
        try {
          const r = await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            email: f.email, delivery, visitor_id: sessionStorage.getItem('vid'),
            shipping: { name: f.name, phone: f.phone, address: f.address, city: f.city, country: f.country },
            items: bag.all().map(i => ({ slug: i.slug, qty: i.qty, color: i.color, size: i.size })) }) });
          f.remember ? store.set('elara_me', { email: f.email, name: f.name, phone: f.phone, address: f.address, city: f.city, country: f.country }) : localStorage.removeItem('elara_me');
          bag.save([]);
          el.innerHTML = `<div class="empty"><h1>Thank you</h1><p>Order <b>#${r.order_no}</b> is placed. Total ${money(r.total)}.</p><p class="muted">We will email ${esc(f.email)} to arrange payment and delivery.</p><a class="btn btn-dark" href="shop.html">Keep shopping</a></div>`;
        } catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Place order'; }
      });
      draw();
    }
  };

  // ----- start -----
  document.addEventListener('DOMContentLoaded', async () => {
    shell(); paint();
    try { Object.assign(C, await api('/api/content')); } catch {}
    paint();
    if (!sessionStorage.getItem('vid')) api('/api/visitor').then(d => sessionStorage.setItem('vid', d.id)).catch(() => {});
    if (pages[page]) await pages[page]();
    paint();
    document.documentElement.classList.remove('loading');
  });
})();
