// Admin-only gallery manager. All writes use the existing authenticated client;
// admin_users verification and RLS remain the authorization boundaries.
window.createAdminGallery = function (session) {
  'use strict';
  const { el, node, safeImageUrl } = session;
  let items = [];
  let loaded = false;
  let editingId = null;
  let deletingId = null;
  const allowed = () => !session.busy && !el('admin-dashboard').hidden;

  function message(text = '', error = false) {
    el('gallery-notice').textContent = error ? '' : text;
    el('gallery-error').textContent = error ? text : '';
    el('gallery-error').hidden = !error;
  }

  function preview(container, value, title = 'ภาพร้าน') {
    container.replaceChildren(node('span', 'ไม่มีรูปภาพ'));
    const url = safeImageUrl(value);
    if (!url) return;
    const image = document.createElement('img');
    image.alt = title || 'ภาพร้าน';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      if (container.contains(image)) container.replaceChildren(node('span', 'ไม่สามารถโหลดรูปได้'));
    }, { once: true });
    image.src = url;
    container.replaceChildren(image);
  }

  function setBusy(value) {
    el('gallery-fields').disabled = value;
    ['add-gallery', 'reload-gallery', 'confirm-gallery-delete', 'cancel-gallery-delete'].forEach(id => { el(id).disabled = value; });
    el('admin-gallery-list').querySelectorAll('button').forEach(button => { button.disabled = value; });
  }

  function reset() {
    items = [];
    loaded = false;
    editingId = deletingId = null;
    el('admin-gallery-list').replaceChildren();
    el('gallery-count').textContent = '';
    el('gallery-editor').hidden = true;
    el('gallery-editor').reset();
    el('gallery-preview').replaceChildren();
    if (el('gallery-delete-dialog').open) el('gallery-delete-dialog').close();
    message();
  }

  async function databaseError(error, fallback) {
    if (['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(error?.code) || [401, 403].includes(error?.status)) {
      await session.signOutToLogin('การเข้าสู่ระบบหรือสิทธิ์ผู้ดูแลไม่ถูกต้อง กรุณาเข้าสู่ระบบอีกครั้ง');
    } else message(fallback, true);
  }

  function render() {
    const list = el('admin-gallery-list');
    list.replaceChildren();
    el('gallery-count').textContent = `${items.length} ภาพ`;
    if (!items.length) list.append(node('p', 'ยังไม่มีภาพ กด “+ เพิ่มภาพใหม่” เพื่อเริ่มต้น', 'admin-empty'));
    for (const item of items) {
      const row = node('article', undefined, 'admin-menu-row');
      const photo = node('div', undefined, 'admin-item-image');
      preview(photo, item.image_url, item.title);
      const info = node('div', undefined, 'admin-item-info');
      info.append(node('h3', item.title || 'ไม่มีชื่อภาพ'), node('p', item.description || 'ไม่มีรายละเอียด', 'admin-item-description'));
      info.append(node('p', `ลำดับ: ${item.display_order ?? 'ไม่ระบุ'}`, 'admin-item-meta'));
      const badges = node('div', undefined, 'menu-badges');
      badges.append(node('span', item.is_visible ? 'แสดงภาพ' : 'ซ่อนภาพ', `menu-badge${item.is_visible ? '' : ' unavailable'}`));
      info.append(badges);
      const actions = node('div', undefined, 'menu-row-actions');
      const action = (text, fn) => {
        const button = node('button', text, 'button outline');
        button.type = 'button';
        button.disabled = session.busy;
        button.addEventListener('click', fn);
        actions.append(button);
        return button;
      };
      action('แก้ไขภาพ', () => openEditor(item));
      action(item.is_visible ? 'ซ่อนภาพ' : 'แสดงภาพ', () => void mutate(
        () => session.client.from('gallery_items').update({ is_visible: !item.is_visible }).eq('id', item.id).select('id::text'),
        'อัปเดตการแสดงภาพแล้ว'
      )).setAttribute('aria-label', `${item.is_visible ? 'ซ่อนภาพ' : 'แสดงภาพ'} ${item.title || 'ไม่มีชื่อภาพ'}`);
      action('ลบภาพ', () => {
        if (!allowed()) return;
        deletingId = item.id;
        el('gallery-delete-description').textContent = `ต้องการลบ “${item.title || 'ไม่มีชื่อภาพ'}” หรือไม่? ภาพนี้จะถูกนำออกจากรายการ`;
        el('gallery-delete-dialog').showModal();
      });
      row.append(photo, info, actions);
      list.append(row);
    }
  }

  async function load(successText = '') {
    const current = session.revision;
    el('admin-gallery-list').setAttribute('aria-busy', 'true');
    message('กำลังโหลดภาพ…');
    try {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await session.client.from('gallery_items')
          .select('id::text,title,description,image_url,is_visible,display_order')
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true }).range(offset, offset + 499);
        if (current !== session.revision) return false;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid response');
        rows.push(...data);
        if (data.length < 500) break;
      }
      items = rows;
      loaded = true;
      render();
      message(successText);
      return true;
    } catch (error) {
      if (current !== session.revision) return false;
      loaded = false;
      items = [];
      el('admin-gallery-list').replaceChildren();
      el('gallery-count').textContent = 'โหลดรายการไม่สำเร็จ';
      await databaseError(error, successText
        ? `${successText} แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณากดโหลดภาพอีกครั้ง ไม่ต้องบันทึกซ้ำ`
        : 'โหลดภาพไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วกดโหลดภาพอีกครั้ง');
      return false;
    } finally { el('admin-gallery-list').setAttribute('aria-busy', 'false'); }
  }

  function openEditor(item = null) {
    if (!allowed()) return;
    editingId = item?.id ?? null;
    el('gallery-editor').reset();
    el('gallery-editor-title').textContent = item ? 'แก้ไขภาพ' : 'เพิ่มภาพใหม่';
    el('gallery-title').value = item?.title ?? '';
    el('gallery-description').value = item?.description ?? '';
    el('gallery-image').value = item?.image_url ?? '';
    el('gallery-order').value = item?.display_order ?? 0;
    el('gallery-visible').checked = item ? item.is_visible === true : true;
    preview(el('gallery-preview'), item?.image_url, item?.title);
    el('gallery-editor').hidden = false;
    message();
    el('gallery-title').focus();
  }

  function readItem() {
    const orderText = el('gallery-order').value.trim();
    const displayOrder = Number(orderText);
    if (!/^-?\d+$/.test(orderText) || !Number.isInteger(displayOrder) || displayOrder < -2147483648 || displayOrder > 2147483647) throw new Error('ลำดับแสดงผลต้องเป็นจำนวนเต็มระหว่าง -2147483648 ถึง 2147483647');
    const imageUrl = el('gallery-image').value.trim();
    if (imageUrl && !safeImageUrl(imageUrl)) throw new Error('กรุณาใช้ลิงก์รูปภาพ http หรือ https ที่ถูกต้อง');
    return { title: el('gallery-title').value.trim(), description: el('gallery-description').value.trim(), image_url: imageUrl, is_visible: el('gallery-visible').checked, display_order: displayOrder };
  }

  async function mutate(request, successText, closeEditor = false) {
    if (!allowed()) return;
    session.setBusy(true);
    let current;
    try {
      if (!await session.verifyAdmin({ load: false })) return;
      current = session.revision;
      message('กำลังบันทึกภาพ…');
      const { data, error } = await request();
      if (current !== session.revision) return;
      if (error) throw error;
      if (!Array.isArray(data) || data.length !== 1) {
        message('ไม่สามารถเปลี่ยนแปลงภาพนี้ได้ รายการอาจถูกลบหรือสิทธิ์มีการเปลี่ยนแปลง กรุณาโหลดภาพอีกครั้ง', true);
        return;
      }
      if (closeEditor) { el('gallery-editor').hidden = true; el('gallery-editor').reset(); editingId = null; }
      await load(successText);
    } catch (error) {
      if (current === undefined) { session.locked('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาออกจากระบบแล้วลองใหม่'); return; }
      if (current !== session.revision) return;
      await databaseError(error, 'บันทึกไม่สำเร็จหรือยังยืนยันผลไม่ได้ กรุณาโหลดภาพเพื่อตรวจสอบก่อนลองใหม่');
    } finally { session.setBusy(false); }
  }

  el('add-gallery').addEventListener('click', () => openEditor());
  el('gallery-image').addEventListener('input', () => preview(el('gallery-preview'), el('gallery-image').value.trim(), el('gallery-title').value));
  el('cancel-gallery-edit').addEventListener('click', () => {
    if (session.busy) return;
    el('gallery-editor').hidden = true;
    el('gallery-editor').reset();
    editingId = null;
    el('add-gallery').focus();
  });
  el('gallery-editor').addEventListener('submit', event => {
    event.preventDefault();
    if (!allowed()) return;
    let values;
    try { values = readItem(); } catch (error) { message(error.message, true); return; }
    if (!el('gallery-editor').reportValidity()) return;
    const id = editingId;
    void mutate(() => id === null
      ? session.client.from('gallery_items').insert(values).select('id::text')
      : session.client.from('gallery_items').update(values).eq('id', id).select('id::text'),
    id === null ? 'เพิ่มภาพแล้ว' : 'บันทึกการแก้ไขภาพแล้ว', true);
  });
  el('reload-gallery').addEventListener('click', async () => {
    if (!allowed()) return;
    session.setBusy(true);
    try { if (await session.verifyAdmin({ load: false })) await load(); }
    catch { session.locked('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาออกจากระบบแล้วลองใหม่'); }
    finally { session.setBusy(false); }
  });
  el('cancel-gallery-delete').addEventListener('click', () => { if (!session.busy) el('gallery-delete-dialog').close(); });
  el('gallery-delete-dialog').addEventListener('close', () => { deletingId = null; });
  el('confirm-gallery-delete').addEventListener('click', () => {
    if (!allowed() || deletingId === null) return;
    const id = deletingId;
    el('gallery-delete-dialog').close();
    void mutate(() => session.client.from('gallery_items').delete().eq('id', id).select('id::text'), 'ลบภาพแล้ว');
  });
  return { setBusy, reset, load, get loaded() { return loaded; } };
};
