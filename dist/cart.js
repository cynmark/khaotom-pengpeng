/* Public food calculator. Storage contains IDs and quantities only. */
(() => {
 'use strict';
 const KEY = 'peng-peng-food-list-v1';
 const MAX_QTY = 99;
 const money = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 const format = cents => money.format(cents / 100) + ' บาท';
 const validId = value => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value);
 function cents(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result <= 100000000 ? result : null;
 }
 function read() {
  try {
   const saved = JSON.parse(localStorage.getItem(KEY));
   if (!Array.isArray(saved) || saved.length > 500) return new Map();
   return new Map(saved.filter(row => row && validId(row.id) && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= MAX_QTY).map(row => [row.id, row.quantity]));
  } catch { return new Map(); }
 }
 let selected = read();
 let catalog = new Map();
 let ready = false;
 let loading = false;
 let returnFocus;
 let announcementTimer;
 const dialog = document.createElement('dialog');
 dialog.className = 'food-cart';
 dialog.setAttribute('aria-labelledby', 'food-cart-title');
 dialog.setAttribute('aria-describedby', 'food-cart-disclaimer');
 dialog.innerHTML = '<header class="cart-header"><div><p>FOOD CALCULATOR</p><h2 id="food-cart-title">รายการอาหารของคุณ</h2></div><button type="button" class="cart-close" aria-label="ปิดรายการอาหาร" autofocus>×</button></header><p id="food-cart-disclaimer" class="cart-disclaimer">รายการนี้ใช้คำนวณราคาโดยประมาณเท่านั้น ไม่ใช่การสั่งอาหารหรือการยืนยันรายการจากร้าน</p><div class="cart-status" role="status" aria-live="polite"></div><button type="button" class="cart-retry" hidden>ลองโหลดราคาอีกครั้ง</button><div class="cart-items"></div><footer class="cart-summary"><div><span>จำนวนรวม</span><strong class="cart-quantity"></strong></div><div class="cart-total-line"><span>รวมโดยประมาณ</span><strong class="cart-total"></strong></div><button type="button" class="cart-copy">คัดลอกรายการอาหาร</button><button type="button" class="cart-clear">ล้างรายการทั้งหมด</button></footer>';
 const opener = document.createElement('button');
 opener.type = 'button';
 opener.className = 'cart-launcher';
 opener.setAttribute('aria-haspopup', 'dialog');
 opener.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3h2l2.5 12h11l2-8H6M9 20h.01M18 20h.01" stroke-linecap="round" stroke-linejoin="round"/></svg><span>รายการอาหาร</span><b class="cart-count">0</b><span class="cart-launcher-total"></span>';
 const toast = document.createElement('div');
 toast.className = 'cart-toast';
 toast.setAttribute('role', 'status');
 toast.setAttribute('aria-live', 'polite');
 document.body.append(opener, dialog, toast);
 const el = selector => dialog.querySelector(selector);
 function announce(text) {
  clearTimeout(announcementTimer);
  toast.textContent = text;
  toast.classList.add('is-visible');
  announcementTimer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
 }
 function persist() {
  try { localStorage.setItem(KEY, JSON.stringify([...selected].map(([id, quantity]) => ({ id, quantity })))); }
  catch { announce('ไม่สามารถบันทึกรายการในเบราว์เซอร์นี้ได้ รายการจะอยู่จนกว่าจะปิดหน้านี้'); }
 }
 function entries() { return [...selected].filter(([id]) => catalog.has(id)).map(([id, quantity]) => ({ ...catalog.get(id), quantity })); }
 function total() { return entries().reduce((sum, item) => sum + item.cents * item.quantity, 0); }
 function button(label, action, id, text) {
  const node = document.createElement('button');
  node.type = 'button'; node.textContent = text; node.setAttribute('aria-label', label);
  node.dataset.action = action; node.dataset.id = id;
  return node;
 }
 function render() {
  const count = [...selected.values()].reduce((sum, qty) => sum + qty, 0);
  opener.querySelector('.cart-count').textContent = count;
  opener.setAttribute('aria-label', `เปิดรายการอาหาร ${count} จาน`);
  opener.querySelector('.cart-launcher-total').textContent = ready ? format(total()) : '';
  el('.cart-quantity').textContent = count + ' จาน';
  el('.cart-total').textContent = ready ? format(total()) : 'รอตรวจสอบราคา';
  el('.cart-copy').disabled = !ready || !selected.size;
  el('.cart-clear').disabled = !selected.size;
  el('.cart-items').replaceChildren();
  if (!ready || !selected.size) {
   const empty = document.createElement('div'); empty.className = 'cart-empty';
   empty.textContent = !ready ? 'กำลังตรวจสอบเมนูและราคาปัจจุบัน กรุณารอสักครู่' : 'ยังไม่มีอาหารในรายการ เลือกจานที่อยากกินแล้วกด + เพิ่มลงรายการ';
   if (ready) { const link = document.createElement('a'); link.href = '/menu.html'; link.textContent = 'เลือกดูเมนูอาหาร ↗'; empty.append(link); }
   el('.cart-items').append(empty);
  } else entries().forEach(item => {
   const row = document.createElement('article'); row.className = 'cart-item';
   const heading = document.createElement('h3'); heading.textContent = item.name;
   const unit = document.createElement('p'); unit.textContent = 'จานละ ' + format(item.cents);
   const controls = document.createElement('div'); controls.className = 'cart-item-controls';
   const minus = button('ลดจำนวน ' + item.name, 'decrease', item.id, '−'); minus.disabled = item.quantity === 1;
   const qty = document.createElement('span'); qty.textContent = item.quantity; qty.setAttribute('aria-label', 'จำนวน ' + item.quantity + ' จาน');
   const plus = button('เพิ่มจำนวน ' + item.name, 'increase', item.id, '+'); plus.disabled = item.quantity >= MAX_QTY;
   const subtotal = document.createElement('strong'); subtotal.className = 'cart-subtotal'; subtotal.textContent = format(item.cents * item.quantity);
   controls.append(minus, qty, plus, subtotal);
   const remove = button('นำ ' + item.name + ' ออกจากรายการ', 'remove', item.id, 'นำออก'); remove.className = 'cart-remove';
   row.append(heading, unit, controls, remove); el('.cart-items').append(row);
  });
 }
 function setCatalog(items) {
  const next = new Map();
  items.forEach(item => {
   const price = cents(item.price); const id = String(item.id ?? '');
   if (validId(id) && price !== null && item.is_available !== false && String(item.name ?? '').trim()) next.set(id, { id, name: String(item.name).trim(), cents: price });
  });
  catalog = next; ready = true;
  let removed = false;
  for (const id of selected.keys()) if (!catalog.has(id)) { selected.delete(id); removed = true; }
  persist(); render();
  el('.cart-status').textContent = removed ? 'นำเมนูที่ไม่พร้อมให้บริการหรือราคาไม่ถูกต้องออกแล้ว' : 'ใช้ราคาเมนูปัจจุบัน ราคาจริงโปรดสอบถามร้าน';
  el('.cart-retry').hidden = true;
 }
 function fail() {
  ready = false; render();
  el('.cart-status').textContent = 'ไม่สามารถตรวจสอบราคาได้ รายการที่บันทึกไว้ยังคงอยู่ กรุณาลองอีกครั้ง';
  el('.cart-retry').hidden = false;
 }
 async function refresh() {
  if (loading) return;
  loading = true; el('.cart-retry').disabled = true;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
  try {
   const client = await Promise.race([window.PengPengSupabase.getClient(), new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true }))]);
   const rows = [];
   for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('menu_items').select('id::text,name,price,is_available').eq('is_available', true).order('display_order', { ascending: true, nullsFirst: false }).order('id', { ascending: true }).range(offset, offset + 499).abortSignal(controller.signal);
    if (error || !Array.isArray(data)) throw new Error('Menu unavailable');
    rows.push(...data); if (data.length < 500) break;
   }
   setCatalog(rows);
  } catch { fail(); }
  finally { clearTimeout(timeout); loading = false; el('.cart-retry').disabled = false; }
 }
 function addButton(item) {
  const node = document.createElement('button'); node.type = 'button'; node.className = 'cart-add';
  node.textContent = '+ เพิ่มลงรายการ'; node.setAttribute('aria-label', 'เพิ่ม ' + item.name + ' ลงรายการอาหาร');
  const id = String(item.id ?? ''); node.disabled = !validId(id) || cents(item.price) === null || item.is_available === false;
  node.addEventListener('click', () => {
   if (!ready || !catalog.has(id)) { announce('กรุณารอการตรวจสอบเมนู หรือเปิดรายการเพื่อลองโหลดราคาอีกครั้ง'); return; }
   const quantity = selected.get(id) || 0;
   if (quantity >= MAX_QTY) { announce('เลือกได้สูงสุด 99 จานต่อเมนู'); return; }
   selected.set(id, quantity + 1); persist(); render(); announce('เพิ่ม ' + catalog.get(id).name + ' ลงรายการแล้ว');
  });
  return node;
 }
 opener.addEventListener('click', () => { returnFocus = document.activeElement; dialog.showModal(); if (!ready && !document.querySelector('#menu-grid')) refresh(); });
 dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
 el('.cart-close').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close(); });
 el('.cart-items').addEventListener('click', event => {
  const node = event.target.closest('button[data-action]'); if (!node || !ready) return;
  const { id, action } = node.dataset; const qty = selected.get(id); if (!qty) return;
  if (action === 'remove') selected.delete(id);
  if (action === 'increase' && qty < MAX_QTY) selected.set(id, qty + 1);
  if (action === 'decrease' && qty > 1) selected.set(id, qty - 1);
  persist(); render();
  const replacement = [...el('.cart-items').querySelectorAll('button')].find(b => b.dataset.id === id && b.dataset.action === action && !b.disabled);
  (replacement || el('.cart-close')).focus();
 });
 el('.cart-clear').addEventListener('click', () => { if (confirm('ล้างรายการอาหารทั้งหมดหรือไม่?')) { selected.clear(); persist(); render(); el('.cart-close').focus(); } });
 el('.cart-copy').addEventListener('click', async () => {
  if (!ready || !selected.size) return;
  const text = ['รายการอาหารโดยประมาณ — ข้าวต้มเพ่งเพ้ง', ...entries().map(item => `${item.name} × ${item.quantity} | จานละ ${format(item.cents)} | รวม ${format(item.cents * item.quantity)}`), `จำนวนรวม ${[...selected.values()].reduce((sum, qty) => sum + qty, 0)} จาน`, `รวมโดยประมาณ ${format(total())}`, 'รายการนี้ไม่ใช่คำสั่งซื้อหรือการยืนยันจากร้าน ราคาจริงโปรดสอบถามร้าน'].join('\n');
  try { await navigator.clipboard.writeText(text); el('.cart-status').textContent = 'คัดลอกรายการอาหารแล้ว'; }
  catch { el('.cart-status').textContent = 'คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกและคัดลอกข้อความด้านล่าง'; const area = document.createElement('textarea'); area.className = 'cart-copy-text'; area.readOnly = true; area.setAttribute('aria-label', 'รายการอาหารสำหรับคัดลอก'); area.value = text; el('.cart-items').replaceChildren(area); area.focus(); area.select(); }
 });
 el('.cart-retry').addEventListener('click', refresh);
 window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { selected = read(); if (ready) setCatalog([...catalog.values()].map(item => ({ ...item, price: (item.cents / 100).toFixed(2) }))); else render(); } });
 window.addEventListener('pageshow', event => { if (event.persisted) { selected = read(); refresh(); } });
 window.PengPengCart = Object.freeze({ addButton, setCatalog, fail });
 render();
 if (!document.querySelector('#menu-grid')) refresh();
})();
