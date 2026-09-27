// Shared menu/gallery uploads. RLS and the existing verified admin client own access.
window.createAdminUploads = function (session) {
  'use strict';
  const { el } = session;
  const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const maxBytes = 5 * 1024 * 1024;

  function previewMenu() {
    const container = el('item-preview');
    container.textContent = 'ไม่มีรูปภาพ';
    const url = session.safeImageUrl(el('item-image').value.trim());
    if (!url) return;
    const image = document.createElement('img');
    image.alt = 'ภาพเมนูตัวอย่าง';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      if (container.contains(image)) container.textContent = 'ไม่สามารถโหลดรูปได้';
    }, { once: true });
    image.src = url;
    container.replaceChildren(image);
  }
  el('item-image').addEventListener('input', previewMenu);

  for (const prefix of ['item', 'gallery']) {
    const fileInput = el(`${prefix}-file`);
    const status = el(`${prefix}-upload-status`);
    const errorBox = el(`${prefix}-upload-error`);
    const form = el(prefix === 'item' ? 'menu-editor' : 'gallery-editor');
    const clear = () => { status.textContent = ''; errorBox.textContent = ''; errorBox.hidden = true; };
    const showError = text => { status.textContent = ''; errorBox.textContent = text; errorBox.hidden = false; };
    const validate = file => {
      if (!file) return 'กรุณาเลือกไฟล์ภาพก่อนอัปโหลด';
      if (!Object.hasOwn(types, file.type)) return 'กรุณาเลือกภาพ JPEG, PNG หรือ WebP เท่านั้น';
      if (!file.size || file.size > maxBytes) return 'กรุณาเลือกภาพที่มีขนาดมากกว่า 0 และไม่เกิน 5 MB';
      return '';
    };
    form.addEventListener('reset', () => {
      clear();
      fileInput.value = '';
      if (prefix === 'item') el('item-preview').textContent = 'ไม่มีรูปภาพ';
    });
    fileInput.addEventListener('change', () => {
      clear();
      const file = fileInput.files?.[0];
      const error = validate(file);
      if (error) { showError(error); return; }
      status.textContent = `พร้อมอัปโหลด: ${file.name}`;
    });
    el(`${prefix}-upload`).addEventListener('click', async () => {
      if (session.busy || el('admin-dashboard').hidden || form.hidden) return;
      clear();
      const file = fileInput.files?.[0];
      const validation = validate(file);
      if (validation) { showError(validation); return; }
      session.setBusy(true);
      let current;
      try {
        status.textContent = 'กำลังตรวจสอบสิทธิ์…';
        if (!await session.verifyAdmin({ load: false })) return;
        current = session.revision;
        status.textContent = 'กำลังอัปโหลดภาพ… กรุณารอสักครู่';
        // Never use the original filename as a path, and never overwrite objects.
        const path = `${prefix === 'item' ? 'menu' : 'gallery'}/${crypto.randomUUID()}.${types[file.type]}`;
        const bucket = session.client.storage.from('restaurant-images');
        const { data, error } = await bucket.upload(path, file, {
          contentType: file.type, cacheControl: '3600', upsert: false
        });
        if (current !== session.revision) return;
        if (error) throw error;
        if (!data?.path) throw new Error('Upload response missing');
        const { data: publicData } = bucket.getPublicUrl(data.path);
        if (!session.safeImageUrl(publicData?.publicUrl)) throw new Error('Public URL unavailable');
        const input = el(`${prefix}-image`);
        input.value = publicData.publicUrl;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.value = '';
        status.textContent = 'อัปโหลดสำเร็จ ใส่ลิงก์รูปภาพแล้ว กรุณากดบันทึกเมนูหรือภาพเพื่อบันทึกรายการ';
      } catch (error) {
        if (current === undefined) {
          session.locked('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาออกจากระบบแล้วลองใหม่');
          return;
        }
        if (current !== session.revision) return;
        if ([401, 403].includes(Number(error?.statusCode ?? error?.status))) {
          await session.signOutToLogin('การเข้าสู่ระบบหรือสิทธิ์อัปโหลดไม่ถูกต้อง กรุณาเข้าสู่ระบบอีกครั้ง');
        } else {
          showError('อัปโหลดไม่สำเร็จหรือยังยืนยันผลไม่ได้ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่ ลิงก์เดิมยังไม่ถูกเปลี่ยน');
        }
      } finally { session.setBusy(false); }
    });
  }
  return { previewMenu };
};
