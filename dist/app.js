document.querySelector('.nav-toggle')?.addEventListener('click',function(){const expanded=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!expanded));this.setAttribute('aria-label',expanded?'เปิดเมนูนำทาง':'ปิดเมนูนำทาง');document.querySelector('#navigation').classList.toggle('open',!expanded)});
document.querySelectorAll('#navigation a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#navigation').classList.remove('open');document.querySelector('.nav-toggle').setAttribute('aria-expanded','false')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('#navigation')?.classList.remove('open');document.querySelector('.nav-toggle')?.setAttribute('aria-expanded','false')}});

// Sample menu: replace prices and availability with the restaurant's confirmed menu.
const menu=[
 {name:'ผัดผักบุ้งไฟแดง',category:'ผัด',price:60,image:'morning-glory',description:'ผักบุ้งกรอบ ๆ ผัดไฟแรง หอมกระเทียมและพริก',popular:true},
 {name:'ยำไข่เค็ม',category:'ยำ',price:70,image:'salted-egg',description:'ไข่เค็มเนื้อมัน คลุกน้ำยำรสจัดจ้าน เปรี้ยวกลมกล่อม',popular:true},
 {name:'ยำหมูกรอบ',category:'ยำ',price:120,image:'crispy-pork',description:'หมูกรอบชิ้นพอดีคำ คลุกน้ำยำ หอมแดง และพริก',popular:true},
 {name:'โจ๊กหมูสับ',category:'ต้ม',price:50,image:'porridge',description:'โจ๊กเนื้อนุ่มกับหมูสับ โรยขิงและต้นหอม',popular:true},
 {name:'ข้าวไข่เจียวทรงเครื่อง',category:'ทอด',price:65,image:'omelet',description:'ไข่เจียวสีทอง ราดหมูสับผัดผัก เสิร์ฟพร้อมข้าว',popular:true},
 {name:'ต้มผักกาดดองซี่โครงหมู',category:'ต้ม',price:90,image:'soup',description:'ซี่โครงหมูนุ่มในน้ำซุปผักกาดดอง ซดร้อน ๆ คล่องคอ',popular:true},
 {name:'หนำเลี้ยบผัดหมูสับ',category:'ผัด',price:90,image:'olive-pork',description:'หมูสับผัดหนำเลี้ยบรสเค็มหอม คู่ข้าวต้มที่ลงตัว',popular:false},
 {name:'ข้าวต้มกุ๊ย',category:'ต้ม',price:15,image:'hero',description:'ข้าวต้มร้อน ๆ รสเรียบง่าย กินกับกับข้าวได้ทุกจาน',popular:false},
 {name:'ชาไทยเย็น',category:'เครื่องดื่ม',price:35,image:'tea',description:'ชาไทยหอมเข้ม เติมนมให้หวานมัน สดชื่น',popular:false}
];
const card=item=>`<article class="food-card"><div class="food-photo"><img src="/assets/${item.image}.jpg" width="600" height="400" loading="lazy" alt="${item.name}">${item.popular?'<span class="food-label">เมนูแนะนำ</span>':''}</div><div class="food-info"><div class="food-top"><h3>${item.name}</h3><span class="food-price">${item.price} <small>฿</small></span></div><p>${item.description}</p></div></article>`;
const popularGrid=document.querySelector('#popular-grid');
if(popularGrid)popularGrid.innerHTML=menu.filter(item=>item.popular).map(card).join('');

// Only the full menu uses live data; homepage featured dishes stay unchanged.
const menuGrid = document.querySelector('#menu-grid');
let publicMenu = [];
let selectedCategory = 'ทั้งหมด';
let menuState = 'loading';
const normalizeMenuText = value => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('th');
const baht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

function menuCard(item) {
 const node = document.createElement('article');
 node.className = 'food-card';
 // This template is fixed; database content is assigned only through textContent.
 node.innerHTML = '<div class="food-photo"><img width="600" height="400" loading="lazy"></div><div class="food-info"><div class="food-top"><h3></h3><span class="food-price"></span></div><p></p></div>';
 node.querySelector('h3').textContent = item.name;
 const price = node.querySelector('.food-price');
 price.append(document.createTextNode(baht.format(Number(item.price)) + ' '));
 const unit = document.createElement('small');
 unit.textContent = 'บาท';
 price.append(unit);
 node.querySelector('p').textContent = item.description;
 const photo = node.querySelector('.food-photo');
 const img = node.querySelector('img');
 const fallback = () => {
  img.remove();
  photo.style.cssText = 'display:grid;place-items:center;background:var(--paper);color:var(--muted)';
  const label = document.createElement('span');
  label.textContent = 'ยังไม่มีรูปภาพ';
  photo.append(label);
 };
 img.alt = item.name;
 img.referrerPolicy = 'no-referrer';
 img.addEventListener('error', fallback, { once: true });
 try {
  const url = new URL(item.image_url);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
  img.src = url.href;
 } catch { fallback(); }
 if (item.is_recommended) {
  const badge = document.createElement('span');
  badge.className = 'food-label';
  badge.textContent = 'เมนูแนะนำ';
  photo.append(badge);
 }
 return node;
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
  (selectedCategory === 'ทั้งหมด' || (selectedCategory === 'เมนูแนะนำ' ? item.is_recommended : item.category === selectedCategory)) &&
  [item.name, item.description, item.category].some(value => normalizeMenuText(value).includes(query)));
 menuGrid.replaceChildren(...results.map(menuCard));
 document.querySelector('#result-count').textContent = menuState === 'ready' ? `${results.length} เมนู` : '';
 document.querySelector('#empty-results').hidden = menuState !== 'ready' || !publicMenu.length || results.length > 0;
 document.querySelector('#clear-search').hidden = !query;
 return results;
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
    .select('name,description,price,category,image_url,is_recommended')
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
  updateFilters();
  status.textContent = publicMenu.length ? '' : 'ยังไม่มีเมนูที่พร้อมให้บริการในขณะนี้';
 } catch {
  menuState = 'error';
  status.textContent = 'ไม่สามารถโหลดเมนูได้ในขณะนี้ กรุณาลองอีกครั้ง';
  retry.hidden = false;
 } finally {
  clearTimeout(timeout);
  menuGrid.setAttribute('aria-busy', 'false');
  renderMenu();
 }
}

if (menuGrid) {
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
  updateFilters();
  renderMenu();
  document.querySelector('#menu-search').focus();
 });
 document.querySelector('#retry-menu').addEventListener('click', loadPublicMenu);
 loadPublicMenu();
}
document.querySelector('#site-footer').innerHTML=`<div class="container footer-top"><div><a class="brand" href="/"><img class="footer-logo" src="/assets/logo-gold.png" alt="ข้าวต้มเพ่งเพ้ง" width="1362" height="1155" loading="lazy"></a><p>อร่อยง่าย ๆ สไตล์ข้าวต้มเพ่งเพ้ง</p></div><div><h3>แวะมารู้จักกัน</h3><nav aria-label="เมนูท้ายเว็บไซต์"><a href="/">หน้าแรก</a><a href="/menu.html">เมนูอาหาร</a><a href="/#about">เรื่องราวของเรา</a><a href="/#gallery">ภาพร้าน</a><a href="/#contact">ติดต่อร้าน</a></nav></div><div><h3>เจอกันที่ร้าน</h3><p>312/1 ถนนพระสุเมรุ แขวงตลาดยอด<br>เขตพระนคร กรุงเทพฯ 10200</p><a class="footer-social" href="https://www.facebook.com/pengpeng1944" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a class="footer-social" href="tel:+66863329959">086-332-9959</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} ข้าวต้มเพ่งเพ้ง. สงวนลิขสิทธิ์</span><a href="/credits.html">เครดิตภาพถ่าย</a><span>มื้อธรรมดา ที่อร่อยเป็นพิเศษ</span></div>`;
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
