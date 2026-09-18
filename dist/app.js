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

const menuGrid=document.querySelector('#menu-grid');
let selectedCategory='ทั้งหมด';
function renderMenu(){
 const query=(document.querySelector('#menu-search')?.value||'').normalize('NFC').trim().toLocaleLowerCase('th');
 const results=menu.filter(item=>(selectedCategory==='ทั้งหมด'||(selectedCategory==='เมนูแนะนำ'?item.popular:item.category===selectedCategory))&&item.name.normalize('NFC').toLocaleLowerCase('th').includes(query));
 if(menuGrid){menuGrid.innerHTML=results.map(card).join('');document.querySelector('#result-count').textContent=`${results.length} เมนู`;document.querySelector('#empty-results').hidden=results.length>0;document.querySelector('#clear-search').hidden=!query;}
 return results;
}
if(menuGrid){
 document.querySelector('#menu-search').addEventListener('input',renderMenu);
 document.querySelectorAll('.filter-button').forEach(button=>button.addEventListener('click',()=>{selectedCategory=button.dataset.category;document.querySelectorAll('.filter-button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderMenu()}));
 document.querySelector('#clear-search').addEventListener('click',()=>{document.querySelector('#menu-search').value='';renderMenu();document.querySelector('#menu-search').focus()});
 document.querySelector('#reset-filters').addEventListener('click',()=>{document.querySelector('#menu-search').value='';document.querySelector('[data-category="ทั้งหมด"]').click();document.querySelector('#menu-search').focus()});renderMenu();
}
document.querySelector('#site-footer').innerHTML=`<div class="container footer-top"><div><a class="brand" href="/"><span class="brand-seal" aria-hidden="true">เพ่ง<br>เพ้ง</span><span>ข้าวต้มเพ่งเพ้ง<small>KHAO TOM PENG PENG</small></span></a><p>อร่อยง่าย ๆ สไตล์ข้าวต้มเพ่งเพ้ง</p></div><div><h3>แวะมารู้จักกัน</h3><nav aria-label="เมนูท้ายเว็บไซต์"><a href="/">หน้าแรก</a><a href="/menu.html">เมนูอาหาร</a><a href="/#about">เรื่องราวของเรา</a><a href="/#gallery">แกลเลอรี</a><a href="/#contact">ติดต่อร้าน</a></nav></div><div><h3>เจอกันที่ร้าน</h3><p>312/1 ถนนพระสุเมรุ แขวงตลาดยอด<br>เขตพระนคร กรุงเทพฯ 10200</p><a class="footer-social" href="https://www.facebook.com/pengpeng1944" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a class="footer-social" href="tel:+66863329959">086-332-9959</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} ข้าวต้มเพ่งเพ้ง. สงวนลิขสิทธิ์</span><a href="/credits.html">เครดิตภาพถ่าย</a><span>มื้อธรรมดา ที่อร่อยเป็นพิเศษ</span></div>`;
// Optional agent access uses the same search/filter state as the visible menu.
if(menuGrid&&document.modelContext?.registerTool){
 try{Promise.resolve(document.modelContext.registerTool({name:'filter_restaurant_menu',description:'Filter the displayed sample restaurant menu by category and Thai food name.',inputSchema:{type:'object',properties:{query:{type:'string'},category:{type:'string',enum:['ทั้งหมด','เมนูแนะนำ','ผัด','ต้ม','ทอด','ยำ','เครื่องดื่ม']}},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['query','category'].includes(k))||(input.query!==undefined&&typeof input.query!=='string')||(input.category!==undefined&&!['ทั้งหมด','เมนูแนะนำ','ผัด','ต้ม','ทอด','ยำ','เครื่องดื่ม'].includes(input.category)))throw new Error('Invalid menu filter');document.querySelector('#menu-search').value=input.query??'';selectedCategory=input.category??'ทั้งหมด';document.querySelectorAll('.filter-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===selectedCategory)));return renderMenu().map(({name,category,price})=>({name,category,price,currency:'THB',samplePrice:true}));}})).catch(()=>{});}catch{}
}

