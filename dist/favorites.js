/* Anonymous public favorites: stable IDs only, independent of the food cart. */
(() => {
 'use strict';
 const KEY = 'peng-peng-favorites-v1';
 const validId = id => typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id);
 const notice = document.createElement('div');
 notice.className = 'favorites-notice sr-only';
 notice.setAttribute('role', 'status');
 notice.setAttribute('aria-live', 'polite');
 document.body.append(notice);
 const announce = text => { notice.textContent = text; };
 function read() {
  try {
   const saved = JSON.parse(localStorage.getItem(KEY));
   if (!Array.isArray(saved) || saved.length > 5000) return new Set();
   return new Set(saved.filter(validId));
  } catch { return new Set(); }
 }
 let saved = read();
 let availableIds = null;
 function persist() {
  try { localStorage.setItem(KEY, JSON.stringify([...saved])); }
  catch { announce('บันทึกรายการโปรดในเบราว์เซอร์ไม่ได้ รายการจะอยู่จนกว่าจะปิดหน้านี้'); }
 }
 function updateButtonState(button) {
  const selected = saved.has(button.dataset.favoriteId);
  const name = button.dataset.favoriteName;
  button.setAttribute('aria-pressed', String(selected));
  button.setAttribute('aria-label', selected ? `นำ ${name} ออกจากรายการโปรด` : `เพิ่ม ${name} ลงรายการโปรด`);
 }
 function changed() {
  document.querySelectorAll('button.favorite-button').forEach(updateButtonState);
  window.dispatchEvent(new Event('peng-peng-favorites-change'));
 }
 function reconcile(items) {
  availableIds = new Set(items.filter(item => item.is_available !== false).map(item => String(item.id ?? '')).filter(validId));
  let removed = false;
  for (const id of saved) if (!availableIds.has(id)) { saved.delete(id); removed = true; }
  if (removed) { persist(); announce('นำเมนูที่ไม่พร้อมให้บริการออกจากรายการโปรดแล้ว'); }
  changed();
 }
 function createButton(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'favorite-button';
  button.dataset.favoriteId = String(item.id ?? '');
  button.dataset.favoriteName = String(item.name ?? '');
  button.disabled = !validId(button.dataset.favoriteId) || item.is_available === false;
  button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  updateButtonState(button);
  button.addEventListener('click', () => {
   const id = button.dataset.favoriteId;
   if (!validId(id) || (availableIds && !availableIds.has(id))) return;
   if (saved.has(id)) saved.delete(id); else saved.add(id);
   announce(saved.has(id) ? 'เพิ่ม ' + item.name + ' ในรายการโปรดแล้ว' : 'นำ ' + item.name + ' ออกจากรายการโปรดแล้ว');
   persist(); changed();
  });
  return button;
 }
 window.addEventListener('storage', event => {
  if (event.key !== KEY && event.key !== null) return;
  saved = read();
  if (availableIds) for (const id of saved) if (!availableIds.has(id)) saved.delete(id);
  changed();
 });
 window.PengPengFavorites = Object.freeze({ createButton, reconcile, has: id => saved.has(String(id)), count: () => saved.size });
 async function refresh() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
   const client = await Promise.race([window.PengPengSupabase.getClient(), new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true }))]);
   const rows = [];
   for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('menu_items').select('id::text,is_available').eq('is_available', true).order('id', { ascending: true }).range(offset, offset + 499).abortSignal(controller.signal);
    if (error || !Array.isArray(data)) throw new Error('Menu unavailable');
    rows.push(...data); if (data.length < 500) break;
   }
   reconcile(rows);
  } catch { /* Keep saved IDs when availability cannot be verified. */ }
  finally { clearTimeout(timeout); }
 }
 window.addEventListener('pageshow', event => { if (event.persisted) { saved = read(); changed(); refresh(); } });
 if (!document.querySelector('#menu-grid')) refresh();
})();
