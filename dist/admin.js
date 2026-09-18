// Supabase owns authentication and session storage. RLS remains the database
// security boundary; this UI check does not replace database authorization.
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const form = el('admin-login');
  let client;
  let subscription;
  let busy = true;
  let revision = 0;
  let items = [];
  let editingId = null;
  let deletingId = null;
  let managerLoaded = false;

  function setBusy(value) {
    busy = value;
    el('admin-main').setAttribute('aria-busy', String(value));
    el('login-fields').disabled = value;
    el('logout-button').disabled = value;
    el('retry-button').disabled = value;
    el('login-button').textContent = value ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ / Login';
    el('menu-fields').disabled = value;
    ['add-menu', 'reload-menu', 'confirm-delete', 'cancel-delete'].forEach(id => { el(id).disabled = value; });
    el('admin-menu-list').querySelectorAll('button').forEach(button => { button.disabled = value; });
  }

  function message(text = '') {
    el('admin-error').textContent = text;
    el('admin-error').hidden = !text;
    el('admin-status').textContent = '';
  }

  function login(text = '') {
    resetManager();
    el('admin-dashboard').hidden = true;
    el('session-actions').hidden = true;
    form.hidden = false;
    el('admin-password').value = '';
    message(text);
  }

  function locked(text) {
    resetManager();
    // Fail closed even if a network failure prevents session revocation.
    form.hidden = true;
    el('admin-dashboard').hidden = true;
    el('session-actions').hidden = !client;
    el('admin-password').value = '';
    message(text);
  }

  async function signOutToLogin(text = '') {
    revision++;
    locked('กำลังออกจากระบบ…');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      login(text);
    } catch {
      locked('ยังออกจากระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและกดออกจากระบบอีกครั้ง');
    }
  }

  async function verifyAdmin({ load = true } = {}) {
    const current = ++revision;
    el('admin-dashboard').hidden = true;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (current !== revision) return;
    if (sessionError) throw sessionError;
    if (!sessionData.session) { login(); return; }

    // getUser validates the current token with Supabase Auth. Never authorize
    // from an email, a hard-coded UID, or the local session object alone.
    const { data: userData, error: userError } = await client.auth.getUser();
    if (current !== revision) return;
    if (userError || !userData.user) {
      await signOutToLogin('การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      return;
    }
    const uid = userData.user.id;
    const { data: admin, error } = await client.from('admin_users')
      .select('id').eq('id', uid).maybeSingle();
    if (current !== revision) return;
    if (error) {
      await signOutToLogin('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาลองเข้าสู่ระบบอีกครั้ง');
      return;
    }
    if (!admin || admin.id !== uid) {
      await signOutToLogin('ไม่อนุญาตให้เข้าถึง บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลร้าน');
      return;
    }
    message();
    form.hidden = true;
    el('admin-password').value = '';
    el('admin-dashboard').hidden = false;
    el('session-actions').hidden = false;
    el('admin-main').classList.add('manager-open');
    if (load && !managerLoaded) {
      el('dashboard-title').focus();
      await loadMenu();
    }
    return current === revision;
  }

  async function checkSession() {
    if (busy) return;
    setBusy(true);
    try { await verifyAdmin(); }
    catch { locked('ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาออกจากระบบแล้วลองอีกครั้ง'); }
    finally { setBusy(false); }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !client || !form.reportValidity()) return;
    setBusy(true);
    message();
    try {
      const request = client.auth.signInWithPassword({
        email: el('admin-email').value.trim(),
        password: el('admin-password').value
      });
      // Do not retain passwords in application state, logs, or storage.
      el('admin-password').value = '';
      const { error } = await request;
      if (error) {
        login(error.status === 429
          ? 'มีการเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่'
          : 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน แล้วลองอีกครั้ง');
        return;
      }
      await verifyAdmin();
    } catch {
      locked('ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาออกจากระบบแล้วลองอีกครั้ง');
    } finally { setBusy(false); }
  });

  el('logout-button').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { await signOutToLogin(); }
    finally { setBusy(false); }
  });

  async function start() {
    setBusy(true);
    el('retry-button').hidden = true;
    message();
    el('admin-status').textContent = 'กำลังตรวจสอบการเข้าสู่ระบบ…';
    try {
      client = await window.PengPengSupabase.getAdminClient();
      subscription?.unsubscribe();
      const { data } = client.auth.onAuthStateChange((event) => {
        // Keep this callback synchronous: SDK auth calls inside it can deadlock.
        if (event === 'SIGNED_OUT') {
          revision++;
          resetManager();
          el('admin-dashboard').hidden = true;
          login();
        } else if (!busy && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          el('admin-dashboard').hidden = true;
          setTimeout(checkSession, 0);
        }
      });
      subscription = data.subscription;
      await verifyAdmin();
    } catch {
      locked('เชื่อมต่อระบบผู้ดูแลไม่สำเร็จ กรุณาลองอีกครั้ง');
      el('retry-button').hidden = false;
    } finally { setBusy(false); }
  }

  el('retry-button').addEventListener('click', () => { if (!busy) void start(); });
  // Recheck authorization after returning to a backgrounded admin page.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && client) void checkSession();
  });

  function resetManager() {
    items = [];
    managerLoaded = false;
    editingId = deletingId = null;
    el('admin-menu-list').replaceChildren();
    el('menu-editor').hidden = true;
    el('menu-editor').reset();
    if (el('delete-dialog').open) el('delete-dialog').close();
    el('admin-main').classList.remove('manager-open');
    menuMessage();
  }

  function menuMessage(text = '', error = false) {
    el('menu-notice').textContent = error ? '' : text;
    el('menu-error').textContent = error ? text : '';
    el('menu-error').hidden = !error;
  }

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function safeImageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function renderItems() {
    const list = el('admin-menu-list');
    list.replaceChildren();
    el('menu-count').textContent = `${items.length} เมนู`;
    if (!items.length) list.append(node('p', 'ยังไม่มีเมนูอาหาร กด “+ เพิ่มเมนูใหม่” เพื่อเริ่มต้น', 'admin-empty'));
    items.forEach(item => {
      const row = node('article', undefined, 'admin-menu-row');
      const photo = node('div', 'ไม่มีรูปภาพ', 'admin-item-image');
      const url = safeImageUrl(item.image_url);
      if (url) {
        const img = document.createElement('img');
        img.alt = item.name || 'ภาพเมนูอาหาร';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { photo.replaceChildren(node('span', 'ไม่สามารถโหลดรูปได้')); }, { once: true });
        img.src = url;
        photo.replaceChildren(img);
      }
      const info = node('div', undefined, 'admin-item-info');
      info.append(node('h3', item.name || 'ไม่มีชื่อเมนู'));
      info.append(node('p', item.description || 'ไม่มีรายละเอียด', 'admin-item-description'));
      const meta = node('div', undefined, 'admin-item-meta');
      meta.append(node('span', `ราคา: ${item.price ?? '—'} บาท`), node('span', `หมวดหมู่: ${item.category || 'ไม่ระบุ'}`), node('span', `ลำดับ: ${item.display_order ?? 'ไม่ระบุ'}`));
      const badges = node('div', undefined, 'menu-badges');
      badges.append(node('span', item.is_recommended ? '★ เมนูแนะนำ' : 'เมนูทั่วไป', `menu-badge${item.is_recommended ? ' recommended' : ''}`));
      badges.append(node('span', item.is_available ? 'พร้อมจำหน่าย' : 'ไม่พร้อมจำหน่าย', `menu-badge${item.is_available ? '' : ' unavailable'}`));
      info.append(meta, badges);
      const actions = node('div', undefined, 'menu-row-actions');
      const action = (label, fn) => {
        const button = node('button', label, 'button outline');
        button.type = 'button';
        button.disabled = busy;
        button.addEventListener('click', fn);
        actions.append(button);
        return button;
      };
      action('แก้ไข', () => openEditor(item));
      const toggle = action(item.is_available ? 'ปิดจำหน่าย' : 'เปิดจำหน่าย', () => {
        void mutate(() => client.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id).select('id::text'), 'อัปเดตสถานะการจำหน่ายแล้ว');
      });
      toggle.setAttribute('aria-label', `${item.is_available ? 'ปิด' : 'เปิด'}จำหน่าย ${item.name}`);
      action('ลบ', () => {
        if (busy) return;
        deletingId = item.id;
        el('delete-description').textContent = `ต้องการลบ “${item.name}” หรือไม่? เมนูนี้จะถูกนำออกจากรายการ`;
        el('delete-dialog').showModal();
      });
      row.append(photo, info, actions);
      list.append(row);
    });
  }

  async function databaseError(error, fallback) {
    if (['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(error?.code) || [401, 403].includes(error?.status)) {
      await signOutToLogin('การเข้าสู่ระบบหรือสิทธิ์ผู้ดูแลไม่ถูกต้อง กรุณาเข้าสู่ระบบอีกครั้ง');
    } else {
      menuMessage(fallback, true);
    }
  }

  async function loadMenu(successText = '') {
    const current = revision;
    el('admin-menu-list').setAttribute('aria-busy', 'true');
    menuMessage('กำลังโหลดเมนูอาหาร…');
    try {
      const loaded = [];
      // Fetch every page; stable secondary ordering prevents tied-order gaps.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('menu_items')
          .select('id::text,name,description,price,category,image_url,is_recommended,is_available,display_order')
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true }).range(offset, offset + 499);
        if (current !== revision) return false;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid menu response');
        loaded.push(...data);
        if (data.length < 500) break;
      }
      items = loaded;
      managerLoaded = true;
      renderItems();
      menuMessage(successText);
      return true;
    } catch (error) {
      if (current !== revision) return false;
      items = [];
      managerLoaded = false;
      el('admin-menu-list').replaceChildren();
      el('menu-count').textContent = 'โหลดรายการไม่สำเร็จ';
      await databaseError(error, successText
        ? `${successText} แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณากดโหลดรายการอีกครั้ง ไม่ต้องบันทึกซ้ำ`
        : 'โหลดเมนูไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วกดโหลดรายการอีกครั้ง');
      return false;
    } finally {
      el('admin-menu-list').setAttribute('aria-busy', 'false');
    }
  }

  function openEditor(item = null) {
    if (busy || el('admin-dashboard').hidden) return;
    editingId = item ? item.id : null;
    const editor = el('menu-editor');
    editor.reset();
    el('editor-title').textContent = item ? 'แก้ไขเมนูอาหาร' : 'เพิ่มเมนูใหม่';
    el('item-name').value = item?.name ?? '';
    el('item-description').value = item?.description ?? '';
    el('item-price').value = item?.price ?? '';
    el('item-category').value = item?.category ?? '';
    el('item-image').value = item?.image_url ?? '';
    el('item-order').value = item?.display_order ?? 0;
    el('item-recommended').checked = item?.is_recommended === true;
    el('item-available').checked = item ? item.is_available === true : true;
    editor.hidden = false;
    menuMessage();
    el('item-name').focus();
  }

  function readItem() {
    const name = el('item-name').value.trim();
    const priceText = el('item-price').value.trim();
    const orderText = el('item-order').value.trim();
    const price = Number(priceText);
    const displayOrder = Number(orderText);
    if (!name) throw new Error('กรุณาระบุชื่อเมนู');
    if (!priceText || !Number.isFinite(price) || price < 0) throw new Error('กรุณาระบุราคาที่เป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if (!/^-?\d+$/.test(orderText) || !Number.isInteger(displayOrder) || displayOrder < -2147483648 || displayOrder > 2147483647) throw new Error('ลำดับแสดงผลต้องเป็นจำนวนเต็มระหว่าง -2147483648 ถึง 2147483647');
    const imageUrl = el('item-image').value.trim();
    if (imageUrl && !safeImageUrl(imageUrl)) throw new Error('กรุณาใช้ลิงก์รูปภาพ http หรือ https ที่ถูกต้อง');
    return {
      name, description: el('item-description').value.trim(), price,
      category: el('item-category').value.trim(), image_url: imageUrl,
      is_recommended: el('item-recommended').checked,
      is_available: el('item-available').checked, display_order: displayOrder
    };
  }

  async function mutate(request, successText, closeEditor = false) {
    if (busy || el('admin-dashboard').hidden) return;
    setBusy(true);
    let current;
    try {
      // Revalidate UID and admin membership before every write. RLS still makes
      // the final authorization decision using the current Supabase session.
      if (!await verifyAdmin({ load: false })) return;
      current = revision;
      menuMessage('กำลังบันทึก…');
      const { data, error } = await request();
      if (current !== revision) return;
      if (error) throw error;
      // RLS may affect zero rows without an error; never report that as success.
      if (!Array.isArray(data) || data.length !== 1) {
        menuMessage('ไม่สามารถเปลี่ยนแปลงเมนูนี้ได้ รายการอาจถูกลบหรือสิทธิ์มีการเปลี่ยนแปลง กรุณาโหลดรายการอีกครั้ง', true);
        return;
      }
      if (closeEditor) { el('menu-editor').hidden = true; el('menu-editor').reset(); editingId = null; }
      await loadMenu(successText);
    } catch (error) {
      if (current === undefined) {
        locked('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาออกจากระบบแล้วลองใหม่');
        return;
      }
      if (current !== undefined && current !== revision) return;
      await databaseError(error, 'บันทึกไม่สำเร็จหรือยังยืนยันผลไม่ได้ กรุณาโหลดรายการเพื่อตรวจสอบก่อนลองใหม่');
    } finally { setBusy(false); }
  }

  el('add-menu').addEventListener('click', () => openEditor());
  el('cancel-edit').addEventListener('click', () => {
    if (busy) return;
    el('menu-editor').hidden = true;
    el('menu-editor').reset();
    editingId = null;
    el('add-menu').focus();
  });
  el('menu-editor').addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    let values;
    try { values = readItem(); }
    catch (error) { menuMessage(error.message, true); return; }
    if (!el('menu-editor').reportValidity()) return;
    const id = editingId;
    void mutate(() => id === null
      ? client.from('menu_items').insert(values).select('id::text')
      : client.from('menu_items').update(values).eq('id', id).select('id::text'),
    id === null ? 'เพิ่มเมนูอาหารแล้ว' : 'บันทึกการแก้ไขแล้ว', true);
  });
  el('reload-menu').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { if (await verifyAdmin({ load: false })) await loadMenu(); }
    catch { locked('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาออกจากระบบแล้วลองใหม่'); }
    finally { setBusy(false); }
  });
  el('cancel-delete').addEventListener('click', () => { if (!busy) el('delete-dialog').close(); });
  el('delete-dialog').addEventListener('close', () => { deletingId = null; });
  el('confirm-delete').addEventListener('click', () => {
    if (busy || deletingId === null) return;
    const id = deletingId;
    el('delete-dialog').close();
    void mutate(() => client.from('menu_items').delete().eq('id', id).select('id::text'), 'ลบเมนูอาหารแล้ว');
  });
  void start();
})();
