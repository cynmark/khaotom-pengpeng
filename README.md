# ข้าวต้มเพ่งเพ้ง

A static Thai restaurant website. Serve `dist/` at the root of a web origin; no build or package installation is required.

For local development, run `python -m http.server 4173 --directory dist` and open `http://127.0.0.1:4173/`. Serve the files over HTTP instead of opening them directly from disk.

- `index.html`: restaurant information, featured dishes, gallery, and directions.
- `menu.html`: searchable Supabase menu with category and favorites filters.
- `credits.html`: image sources, credits, and copyright information.
- `admin.html`: separate Supabase Auth session and authorized menu, gallery, and upload management.

`app.js` handles shared navigation, footer, and public menu rendering. `gallery.js`, `cart.js`, and `favorites.js` handle their respective public features. The cart and favorites store only menu IDs (and quantities for the cart) in the visitor's browser. The cart estimates costs and does not submit orders.

`supabase-config.js` contains the HTTPS project origin and browser-safe publishable key. Never put privileged credentials in `dist/`. Public access and Admin writes depend on Supabase RLS and Storage policies. Some menu photos are external; verify image rights and stable sources before launch.

For hosting configuration, release checks, and open issues, see [Phase 11A audit](AUDIT.md).

