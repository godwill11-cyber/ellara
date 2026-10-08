# ELARA luggage store

Storefront (home, shop, product, bag and checkout), a Node/Express backend, a Supabase database and an admin panel.

```
elara/
├─ .env.example              copy to .env and fill in
├─ package.json
├─ backend/
│  ├─ server.js              API, admin login, photo uploads, visitor ID
│  └─ supabase/schema.sql    tables, photo bucket, starter products
└─ public/
   ├─ index.html shop.html product.html checkout.html
   ├─ css/style.css  css/admin.css
   ├─ js/defaults.js         all editable site text and photos
   ├─ js/app.js              storefront logic
   ├─ js/admin.js            admin logic
   ├─ admin/index.html       admin panel at /admin/
   └─ images/                product and lifestyle photos
```

## Setup (5 steps)
1. In Supabase, open **SQL Editor**, paste all of `backend/supabase/schema.sql` and run it.
2. In **Project Settings > API**, copy the **service_role** key (the secret one, not the publishable key).
3. Copy `.env.example` to `.env`. The project URL is already filled in. Add the service_role key, choose an `ADMIN_PASSWORD`, and set `JWT_SECRET` to a long random string.
4. Run `npm install`, then `npm start`.
5. Open http://localhost:3000 (store) and http://localhost:3000/admin/ (admin).

## How it fits together
- The pages call the backend at `/api/...`. Only the backend talks to Supabase, using the service key from `.env`.
- Row Level Security is on with no public policies, so the browser can never read or write the database directly. That is why the publishable key is not used.
- Orders: prices, stock and totals are recalculated on the server. Stock drops when an order is placed.
- Admin: orders (change status), products (add, edit, delete, drafts, photo upload), site content (every text and photo), visitor and sales stats.
- Remember me: the store keeps contact and delivery details on the visitor's device. The admin can stay signed in for 30 days.
- Visitor ID: a short ID from a salted hash of the IP. The raw IP is never stored.

## Notes
- Never put the service_role key in any file under `public/`.
- Payments are not connected. Add Stripe inside `POST /api/orders` when you are ready.
- Starter prices and stock are placeholders. Change them in the admin.
- Deploy to Render, Railway or Fly.io and set the same variables from `.env` there.
