document.querySelector('.nav-toggle')?.addEventListener('click',function(){const expanded=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!expanded));this.setAttribute('aria-label',expanded?'เปิดเมนูนำทาง':'ปิดเมนูนำทาง');document.querySelector('#navigation').classList.toggle('open',!expanded)});
document.querySelectorAll('#navigation a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#navigation').classList.remove('open');document.querySelector('.nav-toggle').setAttribute('aria-expanded','false')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('#navigation')?.classList.remove('open');document.querySelector('.nav-toggle')?.setAttribute('aria-expanded','false')}});

const menuGrid = document.querySelector('#menu-grid');
let publicMenu = [];
let selectedCategory = 'ทั้งหมด';
let menuState = 'loading';
let favoritesOnly = false;
const normalizeMenuText = value => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('th');
const baht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

function menuCard(item, { imageRequired = false } = {}) {
 const node = document.createElement('article');
 node.className = 'food-card';
 const rawImageUrl = String(item.image_url ?? '').trim();
 const hasImageUrl = rawImageUrl.length > 0 || imageRequired;
 // This template is fixed; database content is assigned only through textContent.
 node.innerHTML = hasImageUrl
  ? '<div class="food-photo"><img width="600" height="400" loading="lazy"></div><div class="food-info"><div class="food-top"><h3></h3><span class="food-price"></span></div><p class="food-description"></p></div>'
  : '<div class="food-info"><div class="food-card-kicker" aria-hidden="true">เมนูเพ่งเพ้ง</div><div class="food-top"><h3></h3><span class="food-price"></span></div><p class="food-description"></p></div>';
 if (!hasImageUrl) node.classList.add('food-card--text-only');
 node.querySelector('h3').textContent = item.name;
 const price = node.querySelector('.food-price');
 price.append(document.createTextNode(baht.format(Number(item.price)) + ' '));
 const unit = document.createElement('small');
 unit.textContent = 'บาท';
 price.append(unit);
 const description = node.querySelector('.food-description');
 description.textContent = item.description;
 if (!String(item.description ?? '').trim()) description.hidden = true;
 const photo = node.querySelector('.food-photo');
 if (hasImageUrl) {
  const img = node.querySelector('img');
  const fallback = () => {
   img.remove();
   node.classList.add('food-card--image-failed');
   photo.classList.add('food-photo--fallback');
   const fallbackMark = document.createElement('span');
   fallbackMark.className = 'food-fallback-mark';
   fallbackMark.setAttribute('aria-hidden', 'true');
   fallbackMark.textContent = 'เพ่งเพ้ง';
   const fallbackText = document.createElement('span');
   fallbackText.className = 'food-fallback-text';
   fallbackText.textContent = 'ข้าวต้มเพ่งเพ้ง';
   photo.prepend(fallbackMark, fallbackText);
  };
  img.alt = item.name;
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', fallback, { once: true });
  try {
   const url = new URL(rawImageUrl);
   if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
   img.src = url.href;
  } catch { fallback(); }
 }
 if (item.is_recommended) {
  const badge = document.createElement('span');
  badge.className = 'food-label';
  badge.textContent = 'เมนูแนะนำ';
  if (photo) photo.append(badge);
  else {
   badge.classList.add('food-label--text');
   node.querySelector('.food-info').prepend(badge);
  }
 }
 if (menuGrid && window.PengPengCart) node.querySelector('.food-info').append(window.PengPengCart.addButton(item));
 if (window.PengPengFavorites) (photo || node.querySelector('.food-info')).append(window.PengPengFavorites.createButton(item));
 return node;
}

const popularGrid = document.querySelector('#popular-grid');

async function loadPopularMenu() {
 if (!popularGrid || popularGrid.getAttribute('aria-busy') === 'true') return;
 const status = document.querySelector('#popular-status');
 const retry = document.querySelector('#popular-retry');
 popularGrid.setAttribute('aria-busy', 'true');
 retry.hidden = true;
 status.textContent = 'กำลังโหลดเมนูแนะนำ...';
 popularGrid.replaceChildren();
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 20000);
 try {
  const client = await Promise.race([
   window.PengPengSupabase.getClient(),
   new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true }))
  ]);
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; rows.length < 6; offset += pageSize) {
   const { data, error } = await client.from('menu_items')
    .select('id::text,name,description,price,category,image_url,is_recommended')
    .eq('is_available', true)
    .eq('is_recommended', true)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1)
    .abortSignal(controller.signal);
   if (error || !Array.isArray(data)) throw new Error('Recommended menu unavailable');
   rows.push(...data.filter(item => {
    try {
     const url = new URL(String(item.image_url ?? '').trim());
     return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
   }));
   if (data.length < pageSize) break;
  }
  const items = rows.slice(0, 6).map(item => ({ ...item,
   name: String(item.name ?? '').trim(), description: String(item.description ?? '').trim(),
   category: String(item.category ?? '').trim(), image_url: String(item.image_url ?? '').trim()
  }));
  popularGrid.replaceChildren(...items.map(item => menuCard(item)));
  status.textContent = items.length ? '' : 'ขณะนี้ยังไม่มีเมนูแนะนำ';
 } catch {
  status.textContent = 'ไม่สามารถโหลดเมนูแนะนำได้ในขณะนี้ กรุณาลองอีกครั้ง';
  retry.hidden = false;
 } finally {
  clearTimeout(timeout);
  popularGrid.setAttribute('aria-busy', 'false');
 }
}

if (popularGrid) {
 document.querySelector('#popular-retry').addEventListener('click', loadPopularMenu);
 loadPopularMenu();
}

function updateFilters() {
 const filters = document.querySelector('.filters');
 const categories = ['ทั้งหมด', 'เมนูแนะนำ', ...new Set(publicMenu.map(item => item.category).filter(category => category && !['ทั้งหมด', 'เมนูแนะนำ'].includes(category)))];
 if (!categories.includes(selectedCategory)) selectedCategory = 'ทั้งหมด';
 filters.replaceChildren(...categories.map(category => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-button';
  button.dataset.category = category;
  button.textContent = category;
  button.setAttribute('aria-pressed', String(category === selectedCategory));
  button.addEventListener('click', () => {
   selectedCategory = category;
   filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
   renderMenu();
  });
  return button;
 }));
}

function renderMenu() {
 const query = normalizeMenuText(document.querySelector('#menu-search').value);
 const results = publicMenu.filter(item =>
  (!favoritesOnly || window.PengPengFavorites?.has(item.id)) &&
  (selectedCategory === 'ทั้งหมด' || (selectedCategory === 'เมนูแนะนำ' ? item.is_recommended : item.category === selectedCategory)) &&
  [item.name, item.description, item.category].some(value => normalizeMenuText(value).includes(query)));
 renderMenuPresentation(results);
 document.querySelector('#result-count').textContent = menuState === 'ready' ? `${results.length} เมนู` : '';
 document.querySelector('#empty-results').hidden = menuState !== 'ready' || !publicMenu.length || results.length > 0;
 document.querySelector('#clear-search').hidden = !query;
 const empty = document.querySelector('#empty-results');
 const noFavorites = favoritesOnly && !window.PengPengFavorites?.count();
 empty.querySelector('h2').textContent = noFavorites ? 'ยังไม่มีรายการโปรด' : 'ยังไม่พบเมนูที่ค้นหา';
 empty.querySelector('p').textContent = noFavorites ? 'กดหัวใจที่เมนูที่ชอบ เพื่อเก็บไว้ในรายการโปรดของคุณ' : 'ลองใช้คำค้นอื่น หรือดูอาหารทุกหมวดหมู่';
 if (noFavorites && menuState === 'ready') empty.hidden = false;
 return results;
}

function renderMenuPresentation(results) {
 const featured = results.filter(item => item.is_recommended && String(item.image_url ?? '').trim());
 const featuredSet = new Set(featured);
 const classic = results.filter(item => !featuredSet.has(item));
 const sections = [];
 if (featured.length) {
  const section = document.createElement('section');
  section.className = 'featured-menu';
  section.setAttribute('aria-labelledby', 'featured-menu-heading');
  section.innerHTML = '<div class="menu-section-heading"><p class="eyebrow">PENG PENG FAVORITES</p><h2 id="featured-menu-heading">เมนูแนะนำ</h2></div><div class="menu-grid featured-menu-grid"></div>';
  section.querySelector('.featured-menu-grid').replaceChildren(...featured.map(item => menuCard(item, { imageRequired: true })));
  sections.push(section);
 }
 if (classic.length) {
  const section = document.createElement('section');
  section.className = 'classic-menu';
  section.setAttribute('aria-labelledby', 'classic-menu-heading');
  section.innerHTML = '<div class="menu-section-heading"><p class="eyebrow">THE MENU</p><h2 id="classic-menu-heading">รายการอาหาร</h2></div><div class="classic-menu-groups"></div>';
  const groups = new Map();
  classic.forEach(item => {
   const category = item.category || 'อื่น ๆ';
   if (!groups.has(category)) groups.set(category, []);
   groups.get(category).push(item);
  });
  groups.forEach((items, category) => {
   const group = document.createElement('div');
   group.className = 'classic-menu-category';
   const heading = document.createElement('h3');
   heading.textContent = category;
   const list = document.createElement('ul');
   items.forEach(item => {
    const row = document.createElement('li');
    row.className = 'classic-menu-row';
    const name = document.createElement('span');
    name.className = 'classic-menu-name';
    name.textContent = item.name;
    if (item.is_recommended) {
     const badge = document.createElement('small');
     badge.className = 'classic-menu-badge';
     badge.textContent = 'เมนูแนะนำ';
     name.append(badge);
    }
    const price = document.createElement('span');
    price.className = 'classic-menu-price';
    price.textContent = baht.format(Number(item.price)) + ' บาท';
    row.append(name, price);
    if (window.PengPengCart) row.append(window.PengPengCart.addButton(item));
    if (window.PengPengFavorites) row.append(window.PengPengFavorites.createButton(item));
    list.append(row);
   });
   group.append(heading, list);
   section.querySelector('.classic-menu-groups').append(group);
  });
  sections.push(section);
 }
 menuGrid.replaceChildren(...sections);
}

async function loadPublicMenu() {
 if (menuGrid.getAttribute('aria-busy') === 'true') return;
 const status = document.querySelector('#menu-load-status');
 const retry = document.querySelector('#retry-menu');
 menuState = 'loading';
 publicMenu = [];
 menuGrid.setAttribute('aria-busy', 'true');
 retry.hidden = true;
 status.textContent = 'กำลังโหลดเมนู...';
 renderMenu();
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 20000);
 try {
  // Public client never restores the separate admin session. SELECT only.
  const client = await Promise.race([
   window.PengPengSupabase.getClient(),
   new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Timeout')), { once: true }))
  ]);
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
   const { data, error } = await client.from('menu_items')
    .select('id::text,name,description,price,category,image_url,is_recommended')
    .eq('is_available', true)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1)
    .abortSignal(controller.signal);
   if (error || !Array.isArray(data)) throw new Error('Menu unavailable');
   rows.push(...data);
   if (data.length < pageSize) break;
  }
  publicMenu = rows.map(item => ({ ...item,
   name: String(item.name ?? '').trim(), description: String(item.description ?? '').trim(),
   category: String(item.category ?? '').trim(), image_url: String(item.image_url ?? '').trim()
  }));
  menuState = 'ready';
  window.PengPengCart?.setCatalog(publicMenu);
  window.PengPengFavorites?.reconcile(publicMenu);
  updateFilters();
  status.textContent = publicMenu.length ? '' : 'ยังไม่มีเมนูที่พร้อมให้บริการในขณะนี้';
 } catch {
  menuState = 'error';
  window.PengPengCart?.fail();
  status.textContent = 'ไม่สามารถโหลดเมนูได้ในขณะนี้ กรุณาลองอีกครั้ง';
  retry.hidden = false;
 } finally {
  clearTimeout(timeout);
  menuGrid.setAttribute('aria-busy', 'false');
  renderMenu();
 }
}

if (menuGrid) {
 const favoriteToggle = document.querySelector('#favorites-toggle');
 const syncFavoriteFilter = () => {
  favoriteToggle.setAttribute('aria-pressed', String(favoritesOnly));
  document.querySelector('#favorites-count').textContent = String(window.PengPengFavorites?.count() || 0);
 };
 favoriteToggle.addEventListener('click', () => { favoritesOnly = !favoritesOnly; syncFavoriteFilter(); renderMenu(); });
 window.addEventListener('peng-peng-favorites-change', () => {
  syncFavoriteFilter();
  if (favoritesOnly) {
   const focused = document.activeElement;
   const id = focused?.dataset.favoriteId;
   renderMenu();
   if (id) {
    const replacement = [...menuGrid.querySelectorAll('.favorite-button')].find(button => button.dataset.favoriteId === id);
    (replacement || favoriteToggle).focus();
   }
  }
 });
 syncFavoriteFilter();
 updateFilters();
 document.querySelector('#menu-search').addEventListener('input', renderMenu);
 document.querySelector('#clear-search').addEventListener('click', () => {
  document.querySelector('#menu-search').value = '';
  renderMenu();
  document.querySelector('#menu-search').focus();
 });
 document.querySelector('#reset-filters').addEventListener('click', () => {
  document.querySelector('#menu-search').value = '';
  selectedCategory = 'ทั้งหมด';
  favoritesOnly = false;
  syncFavoriteFilter();
  updateFilters();
  renderMenu();
  document.querySelector('#menu-search').focus();
 });
 document.querySelector('#retry-menu').addEventListener('click', loadPublicMenu);
 loadPublicMenu();
}
document.querySelector('#site-footer').innerHTML=`<div class="container footer-top"><div><a class="brand" href="/"><img class="footer-logo" src="/assets/logo-gold.png" alt="ข้าวต้มเพ่งเพ้ง" width="1362" height="1155" loading="lazy"></a><p>อร่อยง่าย ๆ สไตล์ข้าวต้มเพ่งเพ้ง</p></div><div><h3>แวะมารู้จักกัน</h3><nav aria-label="เมนูท้ายเว็บไซต์"><a href="/">หน้าแรก</a><a href="/menu.html">เมนูอาหาร</a><a href="/#about">เรื่องราวของเรา</a><a href="/#gallery">ภาพร้าน</a><a href="/#contact">ติดต่อร้าน</a></nav></div><div><h3>เจอกันที่ร้าน</h3><p>312/1 ถนนพระสุเมรุ แขวงตลาดยอด<br>เขตพระนคร กรุงเทพฯ 10200</p><a class="footer-social" href="https://www.facebook.com/pengpeng1944" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a class="footer-social" href="tel:+66863329959">086-332-9959</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} ข้าวต้มเพ่งเพ้ง. สงวนลิขสิทธิ์</span><a href="/credits.html">เครดิตและลิขสิทธิ์</a><span>มื้อธรรมดา ที่อร่อยเป็นพิเศษ</span></div>`;
// Optional agent access uses the same live menu and visible filters.
if (menuGrid && document.modelContext?.registerTool) {
 try {
  Promise.resolve(document.modelContext.registerTool({
   name: 'filter_restaurant_menu', description: 'Filter the restaurant menu by category or search text.',
   inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } }, additionalProperties: false },
   annotations: { readOnlyHint: false },
   execute(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['query', 'category'].includes(key)) || (input.query !== undefined && typeof input.query !== 'string') || (input.category !== undefined && typeof input.category !== 'string')) throw new Error('Invalid menu filter');
    document.querySelector('#menu-search').value = input.query ?? '';
    selectedCategory = input.category ?? 'ทั้งหมด';
    updateFilters();
    return renderMenu().map(({ name, category, price }) => ({ name, category, price, currency: 'THB' }));
   }
  })).catch(() => {});
 } catch {}
}
