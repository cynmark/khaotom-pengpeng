// Public gallery only. The anonymous client performs SELECT requests, never writes.
(() => {
  'use strict';
  const grid = document.getElementById('public-gallery-grid');
  if (!grid) return;
  const status = document.getElementById('gallery-status');
  const retry = document.getElementById('gallery-retry');
  let loading = false;

  function figure(item) {
    const element = document.createElement('figure');
    const title = String(item.title ?? '').trim();
    const description = String(item.description ?? '').trim();
    const image = document.createElement('img');
    image.width = 850;
    image.height = 850;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.alt = title || description || 'ภาพร้านข้าวต้มเพ่งเพ้ง';
    const fallback = () => {
      image.remove();
      const placeholder = document.createElement('span');
      placeholder.className = 'gallery-fallback';
      placeholder.textContent = 'ยังไม่มีรูปภาพ';
      element.prepend(placeholder);
    };
    element.append(image);
    image.addEventListener('error', fallback, { once: true });
    try {
      const url = new URL(String(item.image_url ?? '').trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid image');
      image.src = url.href;
    } catch { fallback(); }
    if (title || description) {
      const caption = document.createElement('figcaption');
      for (const text of [title, description].filter(Boolean)) {
        const line = document.createElement('span');
        line.textContent = text;
        caption.append(line);
      }
      element.append(caption);
    }
    return element;
  }

  async function loadGallery() {
    if (loading) return;
    loading = true;
    grid.setAttribute('aria-busy', 'true');
    grid.hidden = true;
    grid.replaceChildren();
    retry.hidden = true;
    status.textContent = 'กำลังโหลดภาพร้าน...';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const client = await Promise.race([
        window.PengPengSupabase.getClient(),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true }))
      ]);
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('gallery_items')
          .select('title,description,image_url')
          .eq('is_visible', true)
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true })
          .range(offset, offset + 499)
          .abortSignal(controller.signal);
        if (error || !Array.isArray(data)) throw new Error('Gallery unavailable');
        rows.push(...data);
        if (data.length < 500) break;
      }
      grid.replaceChildren(...rows.map(figure));
      grid.hidden = rows.length === 0;
      status.textContent = rows.length ? '' : 'ยังไม่มีภาพร้านให้ชมในขณะนี้';
    } catch {
      status.textContent = 'ไม่สามารถโหลดภาพร้านได้ในขณะนี้ กรุณาลองอีกครั้ง';
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      grid.setAttribute('aria-busy', 'false');
      loading = false;
    }
  }
  retry.addEventListener('click', loadGallery);
  void loadGallery();
})();
