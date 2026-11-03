# Phase 11A.2 staging recheck

**READY FOR STAGING DEPLOYMENT.** Use a restricted HTTPS staging origin for the remaining Admin checks. Public production approval is still pending; no staging or production deployment was performed.

| Previous finding | Recheck |
| --- | --- |
| Anonymous API exposed 3 hidden gallery rows | **Resolved for row reads.** The unfiltered anonymous gallery query returned 4 rows, all visible. An explicit hidden-row query returned 0. Anonymous `admin_users` returned 0 rows. This does not establish whether someone with an existing public file URL can still read a hidden image. |
| Wongnai image blocked in the browser | **Resolved for current references.** No Wongnai URL appeared in the 63 menu rows and 4 anonymously readable gallery rows. All 14 distinct non-empty image URLs were tested in Edge with the site's referrer policy. Thirteen loaded on the first pass; the Facebook CDN image that timed out loaded in its Menu card on retry. No invalid URLs or persistent image failures were found. Hidden gallery URLs were not available for inspection. |
| Live Admin and Storage checks outstanding | **Unverified.** Signed-out Admin loaded at all three widths. No authorized live test session was available. Admin access to hidden rows, authenticated Menu/Gallery CRUD, and upload enforcement still need verification. The earlier simulated Admin results do not verify the updated policies. |

Live browser checks passed for 6 homepage recommendations, 63 menu items, 4 gallery images, search/category filters, Cart quantity totals and refresh persistence, Favorites filtering and persistence, mobile navigation, Credits and its footer link. Google Maps embed and directions returned HTTP 200. Homepage, Menu, Credits, and signed-out Admin had zero horizontal overflow at 390px, 768px, and 1440px. No JavaScript exceptions were observed; the console recorded one network socket error. Separately, a **simulated image failure** (blocked external images with live menu data) displayed the intended fallback. No live mutations were attempted.

**Readability only:** `dist/favorites.js` now uses one function to set the heart button's state and accessible label. `dist/favorites.css` drops a selector with no references and formats the media rules without changing breakpoints. `dist/menu.html` indents the existing toolbar, and it and `dist/index.html` refresh the Favorites asset versions. No functional fix was needed. README instructions still match the project. The shared data-loading flows, Admin session and upload code, and main CSS cascade were left intact to avoid regressions. No storage key or saved selections were reset.

JavaScript syntax and `git diff --check` passed. The frontend scan found no loopback HTTP URLs, secret keys, private key markers, or embedded JWTs. The Sites manifest still points to `dist/`; serve it as the HTTPS origin root with no build step. Before production, verify the real Admin session and updated permissions on staging, confirm media rights and file privacy as applicable, and monitor the reliability of external image hosts. No restaurant data, settings, policies, or hosting configuration changed.

## Phase 11A audit (historical)

**NOT YET READY for a public production launch.** The static site passes local and live public smoke tests. Before launch, verify real Admin permissions on the intended HTTPS origin, decide whether hidden gallery media must be private, and confirm rights and stable sources for externally hosted and uploaded photos.

The audit started from a clean `main` working tree. No restaurant records, Storage objects, Supabase settings, or hosting settings were changed.

## Checks and results

| Check | Result |
| --- | --- |
| Live public Supabase | 63 available dishes, 6 homepage recommendations, and 4 visible gallery images rendered. A live dish was added to Cart at its current price and to Favorites. |
| Public pages and responsive layout | Homepage, Menu, Credits, and signed-out Admin loaded at 390px, 768px, and 1440px with no document overflow. Internal links and target anchors resolved. Browser JavaScript exceptions were not observed in the passing runs. |
| Maps | The Google Maps embed and directions link returned HTTP 200. The iframe retains its accessible title. Map gesture behavior was not tested. |
| Images and Storage | Four visible gallery Storage URLs and all ten recommended image URLs returned images with HTTP 200 in the direct HTTP check. Edge blocked a Wongnai image in-page (`ERR_BLOCKED_BY_ORB`); the Menu displayed its fallback. A deliberately broken fixture also exercised the fallback. |
| Cart and Favorites, simulated | Featured and Classic selections, exact satang totals, quantity changes, removal, clearing, clipboard, refresh/navigation persistence, cross-tab Favorites, deleted/unavailable items, empty Favorites, and search/category combinations passed. Loading failures preserved saved items; Menu, homepage recommendations, and Gallery recovered on retry. Fixtures were kept in the temporary browser. The first expanded run timed out; the final simulated run passed with external requests blocked. |
| Admin, simulated | Invalid credentials and non-admin denial, login, restored session, logout, Menu and Gallery create/edit/delete, recommendation/availability/visibility changes, category/order inputs, image previews, invalid MIME/oversize rejection, and simulated upload responses passed. Dashboard fit all three widths. |
| Admin, live | Signed-out entry loaded. Real sign-in, token restoration, authenticated writes, and upload policy enforcement were not tested; no live Admin credentials or authorization session were used. |

## Code changes

- **Functional:** mobile navigation updates the visible state and accessible label through one function. Escape closes an open navigation menu and returns focus to the toggle, without interfering with an open dialog.
- **Readability:** named navigation elements and one delegated link handler replace repeated DOM lookups. Removed obsolete Supabase client comments and updated the README for the current architecture. Existing DOM IDs, class names, and client interfaces remain in place. Large formatting changes and shared Admin/session refactors were deferred to avoid regressions.
- **Cache versions:** the three public entry pages point to the revised `app.js`.

## Security and content

- The configured client uses a browser publishable key and HTTPS project URL. The public client does not restore the Admin session. Admin checks the current user and `admin_users` membership before writes. Server-side RLS and Storage policies remain the enforcement boundary; simulated UI tests do not verify them.
- Anonymous `admin_users` reads returned no rows. Anonymous `gallery_items` reads returned 7 rows, including **3 hidden rows**. Filtering in the browser does not make hidden media private. If these images must be private, review the anonymous `SELECT` policy and restrict access to the underlying files. A public Storage URL can remain readable even after the row is hidden. Confirm Admin can still manage hidden rows after any separately approved policy changes.
- Database text is assigned via `textContent`; HTML templates are static except for the locally generated copyright year. Image URL handling rejects non-HTTP(S) schemes and URLs with credentials. Cart and Favorites validate locally stored IDs and quantities. Image uploads validate type/size before upload; verify server-side restrictions independently.
- Confirm authorship, reuse rights, and attribution for historical, uploaded, and externally hosted images. Where permission allows, use durable approved URLs instead of expiring hotlinks. Do not replace a photo or attribution without verifying its source.

## Performance and accessibility

- Below-fold imagery is lazy-loaded and important image layouts reserve space. The largest local assets are the gold footer logo (~1.38 MB) and header logo (~0.52 MB); lossless or approved optimized variants are the highest-value asset improvement. Existing files were preserved. Some remote menu images exceed 300 KB. No Lighthouse score or production load-time guarantee is claimed.
- Public menu/cart/favorites and gallery make separate reads; defer merging these flows until there is a measured request or latency problem. The pinned Supabase SDK loads from jsDelivr; the site also depends on Google Fonts (with fallback), Google Maps, Supabase Storage, and external image hosts.
- Keyboard and focus checks covered mobile navigation and the Cart dialog; the site has visible focus styles and reduced-motion rules. This was not a full screen-reader or WCAG conformance audit.

## Phase 11B checklist

1. Confirm the intended HTTPS hostname and audience. Use `dist/` as the document root, with `index.html` as the default document and `/menu.html`, `/credits.html`, and `/admin.html` served directly. No build command or SPA fallback is needed. Preserve `.openai/hosting.json` for the existing Site. Root-relative assets require deployment at the origin root, rather than under a path prefix. No production application URL depends on loopback.
2. Review the 3 hidden gallery rows and corresponding file access with the owner. Confirm that anonymous users can read only the intended public data, authenticated non-admins cannot write, and authorized Admin users can manage Menu, Gallery, and uploads. Review any policy changes before applying them. Confirm photo rights and address unstable image links.
3. Confirm Supabase is active and decide how the restaurant will monitor availability. Free projects with low activity can pause after a week; static pages can still load, but live menu/gallery, current cart prices, and Admin access may fail. Consider an approved plan change if uninterrupted availability is needed. See [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
4. Verify the production Supabase Auth Site URL and exact allowed redirect destinations if email confirmation, invitation, or reset links are used. Existing Admin login uses direct email/password authentication and does not require an OAuth callback. See [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls). Keep privileged credentials outside the hosted files.
5. After explicit deployment authorization, stage the static files on HTTPS. On that origin, verify page paths, CDN and Supabase requests, map/directions, and image URLs. Have an authorized owner sign in without sharing a password, refresh to confirm session restoration, test temporary Menu/Gallery rows and Storage uploads, clean up the rows and files, and verify logout. Test denied access with a non-admin account. Repeat the mobile Menu/Cart/Favorites smoke checks; local cart/favorites will start separately on the new origin.
6. Publish only after the launch checks pass. Verify the production URL and keep the previous site version available for rollback. This audit did not commit, push, publish, or deploy.
