/* ==========================================================
   Cellar & Paper 酒窖與紙張 — app.js
   Router + pages. Reuses the legacy renderers (notes / regions /
   frameworks / exam) and builds new experiences on top.
   ========================================================== */
(function(){
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const J = id => JSON.parse(document.getElementById(id).textContent);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

const GRAPES = J('grape-data');
const CHAPTERS = J('notes-data');
const REGIONS = J('regions-data');
const FWS = J('framework-data');
const EXAM = J('exam-data');
const QS = EXAM.questions;

/* ---------- storage (per-browser) ---------- */
const KEY = 'cp-v1';
const DEF = () => ({ kept:[], read:[], last:null, cards:{}, exam:{}, book:[], prefs:{} });
let S = DEF();
try { S = Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }

function toast(msg){
  let t = $('.toast'); if(!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ---------- categories & bottles ---------- */
const CATS = {
  IB:{ n:'I',   zh:'國際黑', en:'International Black', glass:'#3A1016', cap:'#B8903A', hero:'#5E1B21' },
  RB:{ n:'II',  zh:'地方黑', en:'Regional Black',      glass:'#4B2416', cap:'#B8903A', hero:'#6E3320' },
  IW:{ n:'III', zh:'國際白', en:'International White', glass:'#6F7C43', cap:'#842B30', hero:'#4C5830' },
  RW:{ n:'IV',  zh:'地方白', en:'Regional White',      glass:'#B08A35', cap:'#842B30', hero:'#7A5C1C' }
};
const CAT_ORDER = ['IB','RB','IW','RW'];

/* ---------- rack filter tags & quadrant map ---------- */
const COUNTRY_COLORS = {
  'France': '#B5384A', 'Italy': '#2F8F5B', 'Spain': '#D98B2B', 'Portugal': '#6A4C93',
  'Germany': '#1C7293', 'Austria': '#B08900', 'Greece': '#3465A4', 'Hungary': '#8C6D46',
  'USA': '#C2255C', 'Argentina': '#D4692B', 'Chile': '#3FA7A1', 'South Africa': '#7A5230'
};
const QUAD_METRICS = {
  ripen: { zh:'熟成期', en:'Ripening', lowZh:'早熟', lowEn:'Early', highZh:'晚熟', highEn:'Late' },
  body:  { zh:'酒體', en:'Body', lowZh:'輕', lowEn:'Light', highZh:'飽滿', highEn:'Full' },
  acid:  { zh:'酸度', en:'Acidity', lowZh:'低', lowEn:'Low', highZh:'高', highEn:'High' }
};
const RIPEN_TAG_NUM = {'ripen-early':1,'ripen-mid':2,'ripen-late':3};
const TEMP_TAG_NUM = {'temp-cool':1,'temp-moderate':2,'temp-warm':3,'temp-hot':4};
const counters = {};
GRAPES.forEach(g => {
  counters[g.catCode] = (counters[g.catCode]||0) + 1;
  g.no = counters[g.catCode];
  g.rack = CATS[g.catCode].n + ' · No.' + pad(g.no);
  const parts = g.name.split(/\s*\/\s*|\s*\(\s*|\)\s*|\s*&\s*/).map(s=>s.trim()).filter(Boolean);
  g.main = parts[0]; g.aka = parts.slice(1);
  g.f = n => g.fields.find(x => x.num === n) || { zh:[], en:[] };
  g.hay = (g.name + ' ' + g.catZh + ' ' + g.catEn + ' ' + g.fields.map(f => f.zh.join(' ') + ' ' + f.en.join(' ')).join(' ')).toLowerCase();
});
const byId = id => GRAPES.find(g => String(g.id) === String(id));

function bottleSVG(g, label){
  const c = CATS[g.catCode];
  return '<svg class="bottle-svg" viewBox="0 0 60 180" aria-hidden="true">' +
    '<path class="glass" d="M24 2H36V10H35V40C35 50 49 56 49 72V170Q49 176 43 176H17Q11 176 11 170V72C11 56 25 50 25 40V10H24Z" fill="'+c.glass+'"/>' +
    '<rect x="23.5" y="1.5" width="13" height="27" rx="1.5" fill="'+c.cap+'"/>' +
    '<rect x="13" y="94" width="34" height="50" rx="1.5" fill="#F3EBDD"/>' +
    '<line x1="17" y1="103" x2="43" y2="103" stroke="'+c.glass+'" stroke-width=".7"/>' +
    '<text x="30" y="119" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="10" fill="'+c.glass+'">'+esc(label || c.n)+'</text>' +
    '<text x="30" y="131" text-anchor="middle" font-family="Inter, sans-serif" font-size="2.9" letter-spacing=".25" fill="'+c.glass+'">CELLAR &amp; PAPER</text>' +
    '<line x1="19" y1="137" x2="41" y2="137" stroke="'+c.glass+'" stroke-width=".5" opacity=".6"/>' +
    '<path d="M15.5 78V160" stroke="#fff" stroke-opacity=".2" stroke-width="2.2" stroke-linecap="round"/>' +
  '</svg>';
}
const shortRegion = t => t.split(/[(（]/)[0].split(' — ')[0].replace(/[,，、]\s*$/,'').trim();
function emph(t){ // bold a short leading "term:" segment
  const m = String(t).match(/^([^:：]{1,16})[:：](.+)$/);
  return m ? '<b>'+esc(m[1])+'</b>：'+esc(m[2]) : esc(t);
}

/* ---------- regions & cross-links ---------- */
const REGION_LIST = [];
REGIONS.forEach(c => c.regions.forEach(r => REGION_LIST.push({ key:c.zh+'|'+r.zh, country:c, region:r })));
const ALIAS = {
  'Bordeaux':['Bordeaux','Médoc','Pomerol','Saint-Émilion','Pessac-Léognan','Graves','Sauternes'],
  'The Dordogne & South West France':['Cahors','Bergerac','Madiran','Jurançon','Gascogne','South West France'],
  'Burgundy':['Burgundy','Chablis',"Côte d'Or",'Côte de Beaune','Côte de Nuits','Mâconnais'],
  'Beaujolais':['Beaujolais'], 'Alsace':['Alsace'],
  'The Loire Valley':['Loire','Sancerre','Vouvray','Muscadet','Anjou','Touraine','Chinon','Savennières'],
  'The Northern Rhône':['Northern Rhône','Hermitage','Côte Rôtie','Condrieu','Cornas','Saint-Joseph'],
  'The Southern Rhône':['Southern Rhône','Châteauneuf','Gigondas','Tavel','Vacqueyras'],
  'Southern France':['Languedoc','Roussillon','Provence','Bandol',"Pays d'Oc"],
  'Champagne':['Champagne'],
  'Germany':['Germany','Mosel','Rheingau','Pfalz','Franken','Baden','Nahe','Rheinhessen'],
  'Austria':['Austria','Wachau','Kamptal','Burgenland','Weinviertel','Kremstal'],
  'Tokaj':['Tokaj','Hungary'], 'Greece':['Greece','Santorini','Naoussa','Nemea'],
  'Northern Italy':['Piedmont','Piemonte','Barolo','Barbaresco','Veneto','Valpolicella','Soave','Alto Adige','Trentino','Friuli','Gavi'],
  'Central Italy':['Tuscany','Chianti','Montalcino','Bolgheri','Umbria','Marche','Abruzzo','Lazio'],
  'Southern Italy':['Sicily','Etna','Puglia','Campania','Taurasi','Vulture','Southern Italy'],
  'Spain':['Spain','Rioja','Ribera del Duero','Priorat','Rías Baixas','Rueda','Penedès','Navarra','Bierzo','Jumilla','Calatayud'],
  'Jerez (Sherry)':['Jerez','Sherry'],
  'Portugal':['Portugal','Vinho Verde','Dão','Bairrada','Alentejo'],
  'Douro Valley (Port)':['Douro'],
  'California':['California','Napa','Sonoma','Paso Robles','Santa Barbara','Lodi','Mendocino'],
  'Oregon, Washington and New York':['Oregon','Washington','New York','Finger Lakes','Willamette'],
  'Canada':['Canada','Ontario','Okanagan','Niagara'],
  'Chile':['Chile','Maipo','Colchagua','Casablanca','Maule','Elqui'],
  'Argentina':['Argentina','Mendoza','Salta','Luján','Uco Valley'],
  'South Africa':['South Africa','Stellenbosch','Swartland','Paarl','Constantia'],
  'Australia':['Australia','Barossa','Coonawarra','McLaren','Clare Valley','Eden Valley','Hunter','Yarra','Margaret River','Adelaide'],
  'New Zealand':['New Zealand','Marlborough','Central Otago',"Hawke's Bay",'Martinborough']
};
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
REGION_LIST.forEach(e => {
  const words = ALIAS[e.region.en] || [e.region.en];
  e.re = new RegExp('(^|[^A-Za-zÀ-ÿ])(' + words.map(reEsc).join('|') + ')(?![A-Za-zÀ-ÿ])');
  e.zhWords = [e.region.zh.replace(/\(.*$/,'')];
});
const regionUrl = key => '#/maps/' + encodeURIComponent(key);
function regionsForGrape(g){
  const txt = g.f(1).en.join(' ') + ' ' + g.f(2).en.join(' ');
  const ztx = g.f(1).zh.join(' ');
  return REGION_LIST.filter(e => e.re.test(txt) || e.zhWords.some(w => w.length > 1 && ztx.includes(w)));
}
const grapeRegionCache = {};
GRAPES.forEach(g => grapeRegionCache[g.id] = regionsForGrape(g).map(e => e.key));
const grapesForRegion = key => GRAPES.filter(g => grapeRegionCache[g.id].includes(key));
const chapterRegion = num => REGION_LIST.find(e => e.region.chapterNum === num);

/* ---------- legacy bridges ---------- */
const LEG = { notes:$('#view-notes'), regions:$('#view-regions'), framework:$('#view-framework'), exam:$('#view-exam') };
const legacyState = { notes:null, regions:null, framework:null, exam:null };
function showLegacy(which){ Object.keys(LEG).forEach(k => { if(LEG[k]) LEG[k].hidden = k !== which; }); }
function clickLegacy(sidebarSel, attr, val){
  const btn = $$(sidebarSel + ' .ch-btn').find(b => b.dataset[attr] === String(val));
  if(btn) btn.click();
}
function bindLegacySync(sidebarSel, attr, view, toHash){
  const sb = $(sidebarSel); if(!sb) return;
  sb.addEventListener('click', e => {
    const b = e.target.closest('.ch-btn'); if(!b) return;
    const v = b.dataset[attr]; legacyState[view] = v;
    const h = toHash(v); if(location.hash !== h) location.hash = h;
  });
}
bindLegacySync('#notes-sidebar','ch','notes', v => '#/manuscripts/' + v);
bindLegacySync('#region-sidebar','regionKey','regions', v => regionUrl(v));
bindLegacySync('#framework-sidebar','fw','framework', v => '#/outlines/' + v);
bindLegacySync('#exam-sidebar','q','exam', v => '#/tasting/exam/' + v);

function decorateSidebars(){
  $$('#notes-sidebar .ch-btn').forEach(b => b.classList.toggle('read-mark', S.read.includes(+b.dataset.ch)));
  $$('#exam-sidebar .ch-btn').forEach(b => { const st = S.exam[b.dataset.q]; b.classList.toggle('st-ok', st==='ok'); b.classList.toggle('st-again', st==='again'); });
}
['#notes-sidebar','#exam-sidebar'].forEach(sel => { const el = $(sel); if(el) new MutationObserver(decorateSidebars).observe(el, { childList:true }); });

/* ---------- shell refs ---------- */
const PAGE = $('#page');
const FOOT = $('#legacy-foot');
const PROG = $('.cp-progress');

/* ---------- shared fragments ---------- */
function folio(type, no, title, zh, intro, introEn, meta, extra){
  return '<header class="folio '+type+'"><div class="cp-container folio-in"><div>' +
    '<p class="kicker"><span>'+(type==='cellar'?'Cellar':'Paper')+'</span><span class="bar"></span><span class="no">No. '+no+'</span></p>' +
    '<h1>'+title+'</h1><p class="zh-title">'+esc(zh)+'</p></div><div>' +
    '<p class="intro">'+intro+(introEn?'<span class="en">'+introEn+'</span>':'')+'</p>' +
    (meta ? '<div class="meta">'+meta.map(m => '<div><b>'+m[0]+'</b><span>'+m[1]+'</span></div>').join('')+'</div>' : '') +
    (extra || '') + '</div></div></header>';
}
function slotHTML(g){
  return '<a class="slot" href="#/racks/'+g.id+'" title="'+esc(g.name)+'">' +
    (S.kept.includes(g.id) ? '<span class="kept" title="已收藏"></span>' : '') +
    bottleSVG(g, 'No.'+pad(g.no)) + '<span class="no">'+CATS[g.catCode].n+' · '+pad(g.no)+'</span><span class="nm">'+esc(g.main)+'</span></a>';
}
function ringHTML(v, max, label){
  const r = 36, c = 2*Math.PI*r, p = max ? Math.min(1, v/max) : 0;
  return '<div class="ring"><svg viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="'+r+'" fill="none" stroke-width="3"/><circle class="fg" cx="42" cy="42" r="'+r+'" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c*(1-p))+'"/></svg><b>'+label+'</b></div>';
}
const GRAPE_ART = document.getElementById('grape-art') ? document.getElementById('grape-art').innerHTML : '';
function seeded(n){ const d = new Date(); const s = d.getFullYear()*1000 + d.getMonth()*40 + d.getDate(); return (s * 9301 + 49297) % 233280 % n; }

/* =========================================================
   PAGES
   ========================================================= */

/* ---------- Cellar Door (home) ---------- */
function pageHome(){
  const g = GRAPES[seeded(GRAPES.length)];
  const lastCh = CHAPTERS.find(c => c.num === S.last) || CHAPTERS[0];
  const q = QS[seeded(QS.length + 7) % QS.length];
  const pct = Math.round(S.read.length / CHAPTERS.length * 100);
  PAGE.innerHTML =
  '<section class="door-hero"><div class="cp-container"><div>' +
    '<p class="eyebrow"><span class="dot"></span>A wine reading house &middot; WSET Level 3</p>' +
    '<h1>Cellar <i>&amp;</i><br>Paper</h1>' +
    '<p class="zh">酒窖與紙張</p>' +
    '<p class="tag">Where wine is kept, and written.</p>' +
    '<p class="tag-zh">收藏酒，也收藏字。</p>' +
    '<div class="hero-cta"><a class="jc-btn" href="#/racks">走進酒架 Enter the racks</a><a class="jc-btn" href="#/manuscripts">翻開手稿 Open manuscripts</a></div>' +
  '</div><div class="art"><span class="art-ring"></span>'+GRAPE_ART+'</div></div></section>' +

  '<section class="door-strip"><div class="cp-container">' +
    '<a href="#/racks"><b>80</b><span>Bottles · 品種</span></a>' +
    '<a href="#/manuscripts"><b>45</b><span>Manuscripts · 手稿</span></a>' +
    '<a href="#/maps"><b>'+REGION_LIST.length+'</b><span>Regions · 產區</span></a>' +
    '<a href="#/outlines"><b>'+FWS.length+'</b><span>Outlines · 綱要</span></a>' +
    '<a href="#/tasting"><b>'+QS.length+'</b><span>Blind papers · 盲品題</span></a>' +
  '</div></section>' +

  '<section class="door-today cp-container">' +
    '<div class="section-title"><h2>Today’s pour<small>今日一杯</small></h2><span class="jc-label">'+new Date().toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'long'})+'</span></div>' +
    '<div class="today-grid">' +
      '<a class="today-bottle" href="#/racks/'+g.id+'"><div class="b">'+bottleSVG(g,'No.'+pad(g.no))+'</div><div>' +
        '<span class="jc-label">Bottle of the day · Rack '+g.rack+'</span><h3>'+esc(g.main)+'</h3>' +
        '<p>'+esc(g.f(6).zh[0] || g.f(3).zh[0] || '')+'</p><p style="margin-top:14px"><span class="link-arrow">打開這瓶 Open bottle →</span></p></div></a>' +
      '<div class="today-side">' +
        '<a class="mini-card" href="#/manuscripts/'+lastCh.num+'"><span class="go">→</span><span class="jc-label">'+(S.last?'Continue reading · 繼續閱讀':'Start reading · 從第一章開始')+' &middot; '+pct+'% read</span><h4>Ch'+lastCh.num+'. '+esc(lastCh.titleZh)+'</h4><span class="en">'+esc(lastCh.titleEn)+'</span></a>' +
        '<a class="mini-card" href="#/tasting/exam/'+q.num+'"><span class="go">→</span><span class="jc-label">Blind question · 今日盲品題 · '+esc(q.marks)+'</span><h4>'+esc(q.titleZh)+'</h4><span class="en">'+esc(q.titleEn)+'</span></a>' +
      '</div></div></section>' +

  '<section class="house cp-container">' +
    '<div class="section-title"><h2>Two sides of the house<small>酒窖與紙張</small></h2><span class="jc-label">Choose where to begin</span></div>' +
    '<div class="house-grid">' +
      '<div class="side c"><div class="head"><h3>Cellar</h3><span>酒窖</span></div><p class="lead">收藏與熟成：逛酒架、盲品自測、整理你收進來的每一瓶。</p>' +
        '<a class="item" href="#/racks"><span class="n">i.</span><span class="t">The Racks<small>酒架 · 80 個葡萄品種</small></span><span class="c">80</span></a>' +
        '<a class="item" href="#/tasting"><span class="n">ii.</span><span class="t">Blind Tasting<small>盲品 · 翻牌與申論模考</small></span><span class="c">'+QS.length+' + 80</span></a>' +
        '<a class="item" href="#/my"><span class="n">iii.</span><span class="t">My Cellar<small>我的酒窖 · 收藏與進度</small></span><span class="c">'+S.kept.length+' kept</span></a>' +
      '</div>' +
      '<div class="side p"><div class="head"><h3>Paper</h3><span>紙張</span></div><p class="lead">閱讀與書寫：課程手稿、風土地圖、答題綱要。</p>' +
        '<a class="item" href="#/manuscripts"><span class="n">i.</span><span class="t">Manuscripts<small>手稿 · WSET L3 課程筆記</small></span><span class="c">45 ch.</span></a>' +
        '<a class="item" href="#/maps"><span class="n">ii.</span><span class="t">Terroir Maps<small>風土地圖 · 國家 → 產區 → 地塊</small></span><span class="c">'+REGION_LIST.length+'</span></a>' +
        '<a class="item" href="#/outlines"><span class="n">iii.</span><span class="t">Outlines<small>綱要 · 申論題答題框架</small></span><span class="c">'+FWS.length+'</span></a>' +
      '</div></div>' +
    '<a class="book-banner" href="#/book"><div><span class="jc-label" style="color:var(--accent)">Cellar &amp; Paper · 酒窖簿</span><h3>The Cellar Book</h3><p>每喝一支酒，就用 WSET SAT 格式留下一頁。之後可以和酒友並排比較同一支酒的判斷。'+(S.book.length?' 你已經寫了 '+S.book.length+' 頁。':'')+'</p></div><span class="jc-btn jc-btn--solid">寫下一頁 Write a note</span></a>' +
  '</section>';
}

/* ---------- The Racks ---------- */
const RS = { q:'', cat:'ALL', view: S.prefs.rackView || 'rack', tags:[], quadMetric:'ripen', quadLabels:true };
const RK_TAG_DEFS = [
  { labelZh:'熟成期', labelEn:'Ripening', tags:[['ripen-early','早熟 Early'],['ripen-mid','中熟 Mid'],['ripen-late','晚熟 Late']] },
  { labelZh:'氣候冷熱', labelEn:'Temperature', tags:[['temp-cool','涼爽 Cool'],['temp-moderate','溫和 Moderate'],['temp-warm','溫暖 Warm'],['temp-hot','炎熱 Hot']] },
  { labelZh:'氣候類型', labelEn:'Climate Type', tags:[['climate-maritime','海洋性 Maritime'],['climate-continental','大陸型 Continental'],['climate-mediterranean','地中海型 Mediterranean']] }
];
function rkTagRowHTML(){
  return '<div class="rk-tag-row" id="rack-tags">' + RK_TAG_DEFS.map(grp =>
    '<div class="rk-tag-group"><span class="rk-tag-group-label">'+esc(grp.labelZh)+' '+esc(grp.labelEn)+'</span>' +
      grp.tags.map(t => '<button class="rk-tagbtn'+(RS.tags.includes(t[0])?' active':'')+'" data-tag="'+t[0]+'" type="button">'+esc(t[1])+'</button>').join('') +
    '</div>').join('') +
    '<button class="rk-reset-btn" id="rack-tags-reset" type="button"'+(RS.tags.length?'':' hidden')+'>清除標籤 Clear tags</button>' +
  '</div>';
}
function rkQuadLabel(g){
  // short "plot/region" proxy: first key growing region, trimmed of parenthetical detail
  // (no finer plot-level field exists in the data; country is already shown via dot color, so
  // prefer the sub-region after the first comma — e.g. "Bordeaux Left Bank" rather than "France, Bordeaux Left Bank")
  const raw = g.f(1).en[0] || g.f(1).zh[0] || '';
  const trimmed = raw ? shortRegion(raw) : '';
  const comma = trimmed.indexOf(',');
  const region = comma > -1 ? trimmed.slice(comma + 1).trim() : trimmed;
  return { name: g.main, region };
}
function rkQuadSVG(metric, showLabels){
  const m = QUAD_METRICS[metric];
  const W = 1180, H = 720, L = 70, R = 24, T = 18, B = 56;
  const PW = W - L - R, PH = H - T - B, yMax = 3;
  function hash(n, salt){ const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); }
  function px(xVal, seed){ const jx = (hash(seed,1)-0.5)*0.6; const v = Math.max(1, Math.min(4, xVal+jx)); return L + (v-1)/3*PW; }
  function py(yVal, seed){ const jy = (hash(seed,2)-0.5)*0.6; const v = Math.max(1, Math.min(yMax, yVal+jy)); return T + PH - (v-1)/(yMax-1)*PH; }
  let gridLines = '';
  for(let gx=1; gx<=4; gx++){ const x = L+(gx-1)/3*PW; gridLines += '<line class="rk-quad-grid-line" x1="'+x+'" y1="'+T+'" x2="'+x+'" y2="'+(T+PH)+'"/>'; }
  for(let gy=1; gy<=3; gy++){ const y = T+PH-(gy-1)/2*PH; gridLines += '<line class="rk-quad-grid-line" x1="'+L+'" y1="'+y+'" x2="'+(L+PW)+'" y2="'+y+'"/>'; }
  const dots = [], labels = [];
  GRAPES.forEach(g => {
    const v = g.viz; if(!v) return;
    const cx = px(v.temp, g.id), cy = py(v[metric], g.id+1000);
    const color = COUNTRY_COLORS[v.country] || 'var(--ink)';
    const isWhite = g.class === 'white';
    const fill = isWhite ? 'var(--surface)' : color;
    const sw = isWhite ? 2.2 : 1.2;
    dots.push('<circle class="rk-quad-dot" data-id="'+g.id+'" cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="5" fill="'+fill+'" stroke="'+color+'" stroke-width="'+sw+'" opacity="0.9"><title>'+esc(g.main)+' ('+esc(v.country)+') — '+esc(g.catZh)+'</title></circle>');
    if(showLabels){
      const lab = rkQuadLabel(g);
      const flip = cx > L + PW * 0.8; // near the right edge: anchor the label to the left of the dot instead of clipping off-canvas
      const lx = flip ? cx - 7 : cx + 7, ly = cy + 3;
      const anchor = flip ? ' text-anchor="end"' : '';
      labels.push('<text class="rk-quad-dot-label" data-id="'+g.id+'" x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'"'+anchor+'>'+esc(lab.name)+(lab.region ? '<tspan class="rk-quad-dot-label-sub" dx="4">'+esc(lab.region)+'</tspan>' : '')+'</text>');
    }
  });
  return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">' + gridLines +
    '<line class="rk-quad-axis-line" x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+(T+PH)+'"/>' +
    '<line class="rk-quad-axis-line" x1="'+L+'" y1="'+(T+PH)+'" x2="'+(L+PW)+'" y2="'+(T+PH)+'"/>' + dots.join('') + labels.join('') +
    '<text class="rk-quad-axis-label" x="'+L+'" y="'+(T+PH+20)+'">涼爽 Cool</text>' +
    '<text class="rk-quad-axis-label" x="'+(L+PW)+'" y="'+(T+PH+20)+'" text-anchor="end">炎熱 Hot</text>' +
    '<text class="rk-quad-axis-label" x="'+(L+PW/2)+'" y="'+(T+PH+38)+'" text-anchor="middle">氣候冷熱 Climate Temperature →</text>' +
    '<text class="rk-quad-axis-label" x="'+(L-8)+'" y="'+(T+PH)+'" text-anchor="end">'+esc(m.lowZh)+' '+esc(m.lowEn)+'</text>' +
    '<text class="rk-quad-axis-label" x="'+(L-8)+'" y="'+(T+10)+'" text-anchor="end">'+esc(m.highZh)+' '+esc(m.highEn)+'</text>' +
    '<text class="rk-quad-axis-label" x="14" y="'+(T+PH/2)+'" text-anchor="middle" transform="rotate(-90 14 '+(T+PH/2)+')">'+esc(m.zh)+' '+esc(m.en)+' ↑</text>' +
  '</svg>';
}
function rkQuadLegendHTML(){
  return Object.keys(COUNTRY_COLORS).map(c => '<span class="rk-quad-legend-item"><span class="rk-quad-legend-sw" style="background:'+COUNTRY_COLORS[c]+'"></span>'+esc(c)+'</span>').join('') +
    '<span class="rk-quad-legend-shape">● 實心=黑葡萄 Filled = black grape</span><span class="rk-quad-legend-shape">◎ 空心=白葡萄 Ring = white grape</span>';
}
function pageRacks(){
  const counts = CAT_ORDER.map(c => [GRAPES.filter(g => g.catCode===c).length, 'Rack '+CATS[c].n]);
  PAGE.innerHTML = folio('cellar','01','The <i>Racks</i>','酒架',
    '八十個 WSET L3 考綱品種，像八十瓶酒排在四座酒架上。按顏色找、按名字找，點一瓶就打開它的整本故事。',
    'Eighty grape varieties, shelved on four racks. Pull out any bottle to read its whole story.', counts) +
  '<div class="toolbar"><div class="cp-container">' +
    '<div class="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="rack-q" type="text" placeholder="找一瓶：品種、產區、風味… Find a bottle" value="'+esc(RS.q)+'" autocomplete="off"></div>' +
    '<div class="chip-row" id="rack-cats">' + ['ALL'].concat(CAT_ORDER).map(c => '<button class="chip'+(RS.cat===c?' active':'')+'" data-cat="'+c+'" type="button">'+(c==='ALL'?'全部 All':'<span class="sw"></span>'+CATS[c].n+' '+CATS[c].zh)+'</button>').join('') + '</div>' +
    '<div class="seg" id="rack-view"><button type="button" data-v="rack" class="'+(RS.view==='rack'?'on':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3h2v4l2 3v11H7V10l2-3zM15 3h2v4l2 3v11h-6"/></svg>Rack</button><button type="button" data-v="list" class="'+(RS.view==='list'?'on':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>List</button></div>' +
  '</div><div class="cp-container">' + rkTagRowHTML() + '</div></div>' +
  '<div class="cp-container"><div class="rk-quad" id="rack-quad">' +
    '<button type="button" class="rk-quad-head" id="rack-quad-toggle-btn" aria-expanded="true"><span class="zh">品種象限圖</span> <span class="en">Variety Quadrant Map</span>' +
      '<svg class="rk-quad-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
    '<div class="rk-quad-body" id="rack-quad-body">' +
      '<div class="rk-quad-toggle" id="rack-quad-metric"><span class="rk-quad-toggle-label">縱軸 Y axis:</span>' +
        Object.keys(QUAD_METRICS).map(k => '<button class="rk-quadbtn'+(RS.quadMetric===k?' active':'')+'" data-metric="'+k+'" type="button">'+esc(QUAD_METRICS[k].zh)+' '+esc(QUAD_METRICS[k].en)+'</button>').join('') +
        '<button class="rk-quadbtn rk-quad-label-btn'+(RS.quadLabels?' active':'')+'" id="rack-quad-label-btn" type="button">標籤 Labels '+(RS.quadLabels?'開 On':'關 Off')+'</button>' +
      '</div>' +
      '<div class="rk-quad-chart" id="rack-quad-chart"></div>' +
      '<div class="rk-quad-legend" id="rack-quad-legend"></div>' +
      '<div class="rk-quad-hint">每個點直接標出品種名與主要產區（點太多太擠時可關掉標籤）。滑過點可看完整資訊；點一個點 → 打開那支品種的頁面。Each dot is labelled with its variety and key region — hover for full detail, click to open that variety\'s page.</div>' +
    '</div>' +
  '</div></div>' +
  '<div class="cp-container" id="rack-body"></div>';
  const body = $('#rack-body');

  function drawQuad(){
    $('#rack-quad-chart').innerHTML = rkQuadSVG(RS.quadMetric, RS.quadLabels);
    $('#rack-quad-legend').innerHTML = rkQuadLegendHTML();
  }
  $('#rack-quad-metric').addEventListener('click', e => {
    const labelBtn = e.target.closest('#rack-quad-label-btn');
    if(labelBtn){
      RS.quadLabels = !RS.quadLabels;
      labelBtn.classList.toggle('active', RS.quadLabels);
      labelBtn.textContent = '標籤 Labels ' + (RS.quadLabels ? '開 On' : '關 Off');
      drawQuad();
      return;
    }
    const b = e.target.closest('.rk-quadbtn'); if(!b || b.id==='rack-quad-label-btn') return;
    $$('#rack-quad-metric .rk-quadbtn').forEach(x => { if(x.id!=='rack-quad-label-btn') x.classList.remove('active'); });
    b.classList.add('active'); RS.quadMetric = b.dataset.metric; drawQuad();
  });
  $('#rack-quad-chart').addEventListener('click', e => {
    const dot = e.target.closest('.rk-quad-dot'); if(!dot) return;
    location.hash = '#/racks/' + dot.dataset.id;
  });
  $('#rack-quad-toggle-btn').addEventListener('click', () => {
    const btn = $('#rack-quad-toggle-btn'); const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded)); $('#rack-quad-body').hidden = expanded;
  });
  drawQuad();

  $('#rack-tags').addEventListener('click', e => {
    const resetBtn = e.target.closest('#rack-tags-reset');
    if(resetBtn){ RS.tags = []; $('#rack-tags').outerHTML = rkTagRowHTML(); draw(); return; }
    const b = e.target.closest('.rk-tagbtn'); if(!b) return;
    const tag = b.dataset.tag; const idx = RS.tags.indexOf(tag);
    if(idx === -1) RS.tags.push(tag); else RS.tags.splice(idx, 1);
    b.classList.toggle('active'); $('#rack-tags-reset').hidden = !RS.tags.length;
    draw();
  });

  function draw(){
    const q = RS.q.toLowerCase();
    const list = GRAPES.filter(g => (RS.cat==='ALL' || g.catCode===RS.cat) && (!q || g.hay.includes(q)) &&
      (!RS.tags.length || RS.tags.every(t => (g.tags||[]).includes(t))));
    if(!list.length){ body.innerHTML = '<div class="empty show" style="margin:40px 0 80px"><div class="big">這座酒架上沒有找到</div><div>試試別的關鍵字或清除標籤。Nothing matches — try different keywords or clear the tag filters.</div></div>'; return; }
    if(RS.view === 'list'){
      body.innerHTML = '<table class="cat-list"><thead><tr><th>Rack</th><th>Bottle</th><th class="hide-sm">Key places · 主要產地</th><th class="hide-sm">Price · 價格</th></tr></thead><tbody>' +
        list.slice().sort((a,b)=>a.main.localeCompare(b.main)).map(g => '<tr data-id="'+g.id+'"><td><span class="dot" style="background:var(--cat-'+g.catCode.toLowerCase()+')"></span>'+CATS[g.catCode].n+'·'+pad(g.no)+'</td><td class="nm">'+esc(g.name)+'</td><td class="hide-sm">'+esc(g.f(1).en.slice(0,3).map(shortRegion).join(' · '))+'</td><td class="hide-sm">'+esc((g.f(7).zh[0]||'').slice(0,40))+'</td></tr>').join('') + '</tbody></table><div style="height:80px"></div>';
      $$('tr[data-id]', body).forEach(tr => tr.addEventListener('click', () => location.hash = '#/racks/' + tr.dataset.id));
      return;
    }
    body.innerHTML = CAT_ORDER.filter(c => list.some(g => g.catCode===c)).map(c => {
      const items = list.filter(g => g.catCode===c);
      return '<section class="rack" style="--rack-c:var(--cat-'+c.toLowerCase()+')"><div class="rack-head"><span class="rn">'+CATS[c].n+'</span><h3>'+CATS[c].en+'<small>'+CATS[c].zh+'葡萄品種</small></h3><span class="cnt">'+items.length+' bottles</span></div><div class="shelf">'+items.map(slotHTML).join('')+'</div></section>';
    }).join('') + '<div style="height:90px"></div>';
  }
  $('#rack-q').addEventListener('input', e => { RS.q = e.target.value.trim(); draw(); });
  $('#rack-cats').addEventListener('click', e => { const b = e.target.closest('.chip'); if(!b) return; RS.cat = b.dataset.cat; $$('#rack-cats .chip').forEach(x => x.classList.toggle('active', x===b)); draw(); });
  $('#rack-view').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; RS.view = b.dataset.v; S.prefs.rackView = RS.view; save(); $$('#rack-view button').forEach(x => x.classList.toggle('on', x===b)); draw(); });
  draw();
}

/* ---------- A single bottle ---------- */
function pageBottle(id){
  const g = byId(id); if(!g){ location.hash = '#/racks'; return; }
  const c = CATS[g.catCode];
  const sameCat = GRAPES.filter(x => x.catCode === g.catCode);
  const i = sameCat.indexOf(g);
  const prev = sameCat[i-1] || null, next = sameCat[i+1] || null;
  const regs = grapeRegionCache[g.id].map(k => REGION_LIST.find(e => e.key===k));
  const kept = S.kept.includes(g.id);
  const f6 = g.f(6), f3 = g.f(3);
  const quoteZh = f6.zh[0] || f3.zh[0] || '', quoteEn = f6.en[0] || f3.en[0] || '';
  const neighbours = sameCat.filter(x => x !== g).slice(Math.max(0, i-2), Math.max(0, i-2) + 6);

  PAGE.innerHTML =
  '<section class="bt-hero" style="--bt-c:'+c.hero+'"><div class="cp-container">' +
    '<div class="label-card">'+bottleSVG(g,'No.'+pad(g.no))+'</div><div>' +
      '<div class="crumbs"><a href="#/racks">The Racks</a><span>/</span><span>Rack '+c.n+' · '+c.en+'</span><span>/</span><span>No.'+pad(g.no)+'</span></div>' +
      '<h1>'+esc(g.main)+'</h1>' + (g.aka.length ? '<p class="aka">also known as '+esc(g.aka.join(' · '))+'</p>' : '<p class="aka">'+esc(g.catEn)+'</p>') +
      '<div class="tags"><span class="tag">'+c.zh+' '+c.en+'</span><span class="tag">Rack '+esc(g.rack)+'</span></div>' +
      '<div class="facts">' +
        '<div><span>Key places · 主要產地</span><p>'+esc(g.f(1).en.slice(0,3).map(shortRegion).join(' · '))+'</p></div>' +
        '<div><span>Price · 價格區間</span><p>'+esc((g.f(7).zh[0]||'—'))+'</p></div>' +
        '<div><span>Character · 品種特性</span><p>'+esc((f3.zh[0]||'—'))+'</p></div>' +
      '</div>' +
      '<div class="bt-actions"><button class="jc-btn'+(kept?' on':'')+'" id="keep-btn" type="button">'+(kept?'✓ 已收進我的酒窖 Kept':'＋ 收進我的酒窖 Keep')+'</button><a class="jc-btn" href="#/tasting/cards?start='+g.id+'">盲品這瓶 Blind-taste it</a></div>' +
    '</div></div></section>' +
  '<div class="cp-container"><div class="bt-body">' +
    '<nav class="toc" id="bt-toc"><span class="jc-label">Contents · 目錄</span>' + g.fields.map(f => '<a href="#f-'+f.num+'" data-f="'+f.num+'"><i>'+f.num+'</i><span>'+esc(f.labelZh)+'</span></a>').join('') + '</nav>' +
    '<article>' +
      (quoteZh ? '<p class="lead-quote"><span class="lq-zh">'+esc(quoteZh)+'</span><span class="lq-en">'+esc(quoteEn)+'</span></p>' : '') +
      g.fields.map(f => '<section class="chapter" id="f-'+f.num+'"><div class="chapter-h"><span class="n">'+f.num+'</span><h2><span class="zh">'+esc(f.labelZh)+'</span><span class="en">'+esc(f.labelEn)+'</span></h2></div>' +
        '<div class="prose"><ul class="zh">'+f.zh.map(t => '<li>'+emph(t)+'</li>').join('')+'</ul>' + (f.en.length ? '<ul class="en">'+f.en.map(t => '<li>'+emph(t)+'</li>').join('')+'</ul>' : '') + '</div></section>').join('') +
      (regs.length ? '<div class="see-also"><h3>On the maps</h3><p>這瓶酒出現在以下風土地圖 · Find it in Terroir Maps</p><div class="chips-row">'+regs.map(e => '<a class="xlink" href="'+regionUrl(e.key)+'"><i>↗</i>'+esc(e.region.zh)+' '+esc(e.region.en)+'</a>').join('')+'</div></div>' : '') +
      '<div class="see-also"><h3>Neighbours on the rack</h3><p>同一座酒架上的其他瓶 · Rack '+c.n+'</p><div class="shelf">'+neighbours.map(slotHTML).join('')+'</div></div>' +
    '</article></div>' +
    '<nav class="pager">' + (prev ? '<a href="#/racks/'+prev.id+'"><span>← Previous bottle</span><b>'+esc(prev.main)+'<small>Rack '+esc(prev.rack)+'</small></b></a>' : '<span class="empty-slot"></span>') + (next ? '<a class="next" href="#/racks/'+next.id+'"><span>Next bottle →</span><b>'+esc(next.main)+'<small>Rack '+esc(next.rack)+'</small></b></a>' : '<span class="empty-slot"></span>') + '</nav>' +
  '</div>';

  $('#keep-btn').addEventListener('click', e => {
    const b = e.currentTarget, k = S.kept.includes(g.id);
    S.kept = k ? S.kept.filter(x => x!==g.id) : S.kept.concat(g.id); save();
    b.classList.toggle('on', !k); b.textContent = !k ? '✓ 已收進我的酒窖 Kept' : '＋ 收進我的酒窖 Keep';
    toast(!k ? '已收進我的酒窖 · Kept in My Cellar' : '已從酒窖取出 · Removed');
  });
  // TOC: smooth scroll without touching the hash route + scrollspy
  $$('#bt-toc a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = document.getElementById('f-'+a.dataset.f); if(t) t.scrollIntoView({ behavior:'smooth', block:'start' }); }));
  spy($$('.chapter'), $$('#bt-toc a'), 'f-');
}
let spyObs = null;
function spy(sections, links, prefix){
  if(spyObs) spyObs.disconnect();
  if(!('IntersectionObserver' in window) || !sections.length) return;
  spyObs = new IntersectionObserver(entries => {
    entries.forEach(en => { if(en.isIntersecting){ const id = en.target.id.replace(prefix,''); links.forEach(l => l.classList.toggle('on', l.dataset.f === id)); } });
  }, { rootMargin:'-30% 0px -60% 0px' });
  sections.forEach(s => spyObs.observe(s));
}

/* ---------- Manuscripts ---------- */
function pageManuscripts(){
  const parts = [];
  CHAPTERS.forEach(c => { let p = parts.find(x => x.zh === c.sectionZh); if(!p){ p = { zh:c.sectionZh, en:c.sectionEn, chs:[] }; parts.push(p); } p.chs.push(c); });
  const pct = Math.round(S.read.length / CHAPTERS.length * 100);
  PAGE.innerHTML = folio('paper','02','<i>Manuscripts</i>','手稿',
    'WSET Level 3 全部 45 章課程筆記，像一本可以慢慢翻的書。讀完一章就在頁尾蓋上「已讀」，目錄會替你記住。',
    'All 45 chapters of the WSET L3 course, bound like a book. Finish a chapter, mark it read, and the contents will remember.',
    [[S.read.length+'<small style="font-size:.5em;opacity:.6"> / 45</small>','Chapters read'],[pct+'%','Complete']],
    '<div class="meter" style="margin-top:18px"><i style="width:'+pct+'%"></i></div>') +
  '<div class="cp-container"><div class="contents">' + parts.map((p,pi) =>
    '<div class="part"><div class="part-h"><span class="pn">'+ROMAN[pi+1]+'</span><span class="pt">'+esc(p.zh.replace(/^第.+?部分[:：]/,''))+'<small>'+esc(p.en)+'</small></span></div>' +
    p.chs.map(c => { const r = S.read.includes(c.num), cur = S.last === c.num; return '<a class="toc-row'+(r?' read':'')+(cur&&!r?' cur':'')+'" href="#/manuscripts/'+c.num+'"><span class="n">'+c.num+'</span><span class="t">'+esc(c.titleZh)+'<small>'+esc(c.titleEn)+'</small></span><span class="st">'+(r?'Read ✓':cur?'Reading':'')+'</span></a>'; }).join('') + '</div>').join('') +
  '</div></div>';
}
function runningHead(type, trail, back){
  return '<div class="cp-container"><div class="crumbs">'+trail.map((t,i) => (t[1] ? '<a href="'+t[1]+'">'+esc(t[0])+'</a>' : '<span>'+esc(t[0])+'</span>') + (i < trail.length-1 ? '<span>/</span>' : '')).join('')+'</div></div>';
}
function pageChapter(n){
  n = +n; const ch = CHAPTERS.find(c => c.num === n); if(!ch){ location.hash = '#/manuscripts'; return; }
  PAGE.innerHTML = runningHead('paper', [['Paper',''],['Manuscripts','#/manuscripts'],['Chapter '+n,'']]);
  showLegacy('notes');
  if(legacyState.notes !== String(n)){ legacyState.notes = String(n); clickLegacy('#notes-sidebar','ch',n); }
  S.last = n; save();
  const i = CHAPTERS.indexOf(ch), prev = CHAPTERS[i-1], next = CHAPTERS[i+1];
  const reg = chapterRegion(n);
  const isRead = S.read.includes(n);
  const regGrapes = reg ? grapesForRegion(reg.key) : [];
  FOOT.innerHTML = '<div class="read-end"><div class="orn">· · ·</div><p>End of Manuscript '+n+' · 第 '+n+' 章完</p>' +
    '<button class="jc-btn '+(isRead?'jc-btn--solid':'')+'" id="mark-read" type="button">'+(isRead?'✓ 已讀 Read':'蓋上已讀 Mark as read')+'</button></div>' +
    (reg ? '<div class="see-also"><h3>Open the map</h3><p>這章在風土地圖裡有整理好的產區卡片 · '+esc(reg.region.en)+'</p><div class="chips-row"><a class="xlink" href="'+regionUrl(reg.key)+'"><i>↗</i>'+esc(reg.region.zh)+' '+esc(reg.region.en)+'</a>'+regGrapes.slice(0,8).map(g => '<a class="xlink" href="#/racks/'+g.id+'"><i>◐</i>'+esc(g.main)+'</a>').join('')+'</div></div>' : '') +
    '<nav class="pager">' + (prev ? '<a href="#/manuscripts/'+prev.num+'"><span>← Chapter '+prev.num+'</span><b>'+esc(prev.titleEn)+'<small>'+esc(prev.titleZh)+'</small></b></a>' : '<span class="empty-slot"></span>') +
    (next ? '<a class="next" href="#/manuscripts/'+next.num+'"><span>Chapter '+next.num+' →</span><b>'+esc(next.titleEn)+'<small>'+esc(next.titleZh)+'</small></b></a>' : '<span class="empty-slot"></span>') + '</nav>';
  $('#mark-read').addEventListener('click', e => {
    const r = S.read.includes(n); S.read = r ? S.read.filter(x => x!==n) : S.read.concat(n); save(); decorateSidebars();
    e.currentTarget.classList.toggle('jc-btn--solid', !r); e.currentTarget.textContent = !r ? '✓ 已讀 Read' : '蓋上已讀 Mark as read';
    toast(!r ? '已讀 ✓ ' + S.read.length + ' / 45' : '已取消已讀');
  });
  decorateSidebars();
}

/* ---------- Terroir Maps ---------- */
const COMPASS = '<svg class="compass" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1"><circle cx="20" cy="20" r="17"/><path d="M20 5l3.5 15L20 35l-3.5-15z" fill="currentColor" fill-opacity=".15"/><path d="M20 5v30M5 20h30" stroke-width=".5"/><text x="20" y="4" font-size="4" text-anchor="middle" fill="currentColor" stroke="none">N</text></svg>';
function pageMaps(){
  PAGE.innerHTML = folio('paper','03','Terroir <i>Maps</i>','風土地圖',
    '十五個國家、'+REGION_LIST.length+' 個產區，攤開像一疊紙本地圖。每個產區都整理了氣候、地形、風土、法規與重要地塊。',
    'Fifteen countries, folded into paper maps — climate, terrain, terroir and the plots that matter.',
    [[REGIONS.length,'Countries'],[REGION_LIST.length,'Regions']]) +
  '<div class="cp-container"><div class="atlas-grid">' + REGIONS.map((c,ci) =>
    '<div class="mapcard'+(c.regions.length>4?' wide':'')+'">'+COMPASS+'<div class="coord"><span>Map '+pad(ci+1)+'</span></div><h3>'+esc(c.en)+'</h3><div class="zh">'+esc(c.zh)+'</div><div class="regs">' +
    c.regions.map(r => '<a href="'+regionUrl(c.zh+'|'+r.zh)+'">'+esc(r.zh)+'<span>'+esc(r.en)+'</span></a>').join('') + '</div></div>').join('') +
  '</div></div>';
}
function pageRegion(key){
  const e = REGION_LIST.find(x => x.key === key); if(!e){ location.hash = '#/maps'; return; }
  PAGE.innerHTML = runningHead('paper', [['Paper',''],['Terroir Maps','#/maps'],[e.country.en,''],[e.region.en,'']]);
  showLegacy('regions');
  if(legacyState.regions !== key){ legacyState.regions = key; clickLegacy('#region-sidebar','regionKey',key); }
  const i = REGION_LIST.indexOf(e), prev = REGION_LIST[i-1], next = REGION_LIST[i+1];
  const gs = grapesForRegion(key);
  FOOT.innerHTML =
    (gs.length ? '<div class="see-also"><h3>Bottles from this map</h3><p>酒架上與 '+esc(e.region.zh)+' 相關的品種 · '+gs.length+' bottles</p><div class="shelf">'+gs.map(slotHTML).join('')+'</div></div>' : '') +
    '<div class="see-also"><h3>Read the manuscript</h3><p>對應的課程章節 · Chapter '+e.region.chapterNum+'</p><div class="chips-row"><a class="xlink" href="#/manuscripts/'+e.region.chapterNum+'"><i>¶</i>Ch'+e.region.chapterNum+'. '+esc(e.region.zh)+'</a></div></div>' +
    '<nav class="pager">' + (prev ? '<a href="'+regionUrl(prev.key)+'"><span>← Previous map</span><b>'+esc(prev.region.en)+'<small>'+esc(prev.region.zh)+'</small></b></a>' : '<span class="empty-slot"></span>') +
    (next ? '<a class="next" href="'+regionUrl(next.key)+'"><span>Next map →</span><b>'+esc(next.region.en)+'<small>'+esc(next.region.zh)+'</small></b></a>' : '<span class="empty-slot"></span>') + '</nav>';
}

/* ---------- Outlines ---------- */
function pageOutlines(){
  PAGE.innerHTML = folio('paper','04','<i>Outlines</i>','綱要',
    '寫申論題之前先打的草稿。五套答題框架，把「該寫什麼、按什麼順序寫」整理成可以背的骨架。',
    'Five answer frameworks — the skeleton you sketch before you write.', [[FWS.length,'Frameworks']]) +
  '<div class="cp-container"><div class="outline-grid">' + FWS.map(f =>
    '<a class="index-card" href="#/outlines/'+f.num+'"><span class="rn">'+ROMAN[f.num]+'.</span><span class="fw">Framework '+f.num+'</span><h3>'+esc(f.titleZh)+'</h3><div class="en">'+esc(f.titleEn.replace(/^Framework \d+\s*[—-]\s*/,''))+'</div><p>'+esc((f.introZh||'').slice(0,80))+'</p></a>').join('') +
  '</div></div>';
}
function pageOutline(n){
  n = +n; const f = FWS.find(x => x.num === n); if(!f){ location.hash = '#/outlines'; return; }
  PAGE.innerHTML = runningHead('paper', [['Paper',''],['Outlines','#/outlines'],['Framework '+ROMAN[n],'']]);
  showLegacy('framework');
  if(legacyState.framework !== String(n)){ legacyState.framework = String(n); clickLegacy('#framework-sidebar','fw',n); }
  const i = FWS.indexOf(f), prev = FWS[i-1], next = FWS[i+1];
  FOOT.innerHTML = '<div class="see-also"><h3>Put it to the test</h3><p>用綱要寫一題模擬申論 · Try a blind paper</p><div class="chips-row"><a class="xlink" href="#/tasting/exam"><i>✎</i>開始盲品申論 Start a paper</a></div></div>' +
    '<nav class="pager">' + (prev ? '<a href="#/outlines/'+prev.num+'"><span>← Framework '+ROMAN[prev.num]+'</span><b>'+esc(prev.titleZh)+'</b></a>' : '<span class="empty-slot"></span>') +
    (next ? '<a class="next" href="#/outlines/'+next.num+'"><span>Framework '+ROMAN[next.num]+' →</span><b>'+esc(next.titleZh)+'</b></a>' : '<span class="empty-slot"></span>') + '</nav>';
}

/* ---------- Blind Tasting ---------- */
function examStats(){ const v = Object.values(S.exam); return { ok:v.filter(x=>x==='ok').length, again:v.filter(x=>x==='again').length }; }
function cardStats(){ const v = Object.values(S.cards); return { ok:v.filter(x=>x==='ok').length, again:v.filter(x=>x==='again').length }; }
function tastingSubnav(on){
  return '<nav class="subnav"><div class="cp-container"><a href="#/tasting" class="'+(on==='home'?'on':'')+'">Overview 總覽</a><a href="#/tasting/cards" class="'+(on==='cards'?'on':'')+'">Flash Pour 翻牌盲品</a><a href="#/tasting/exam" class="'+(on==='exam'?'on':'')+'">Written Paper 申論模考</a></div></nav>';
}
function pageTasting(){
  const cs = cardStats(), es = examStats();
  const cp = Math.round(cs.ok/80*100), ep = Math.round(es.ok/QS.length*100);
  PAGE.innerHTML = folio('cellar','05','Blind <i>Tasting</i>','盲品',
    '先別看答案。翻牌猜品種、提筆寫申論，再誠實地替自己打分。答不出來的，會自動排回下一輪。',
    'Cover the label first. Guess the grape, write the answer, then mark yourself honestly.',
    [[cs.ok+'/80','Bottles named'],[es.ok+'/'+QS.length,'Papers nailed']]) + tastingSubnav('home') +
  '<div class="cp-container"><div class="bt-choose">' +
    '<a class="choose a" href="#/tasting/cards"><span class="jc-label">Cellar game · 翻牌</span><h3>Flash Pour<small>翻牌盲品</small></h3><p>每張牌只給你香氣、產地與特性線索，猜出是哪個品種，再翻面揭曉。</p><div class="bottom"><div class="meter"><i style="width:'+cp+'%"></i></div><span class="pct">'+cp+'%</span></div></a>' +
    '<a class="choose b" href="#/tasting/exam"><span class="jc-label">Paper game · 申論</span><h3>Written Paper<small>申論模考</small></h3><p>'+QS.length+' 道 L3 模擬申論題。先在紙上作答，再展開官方答案與提示，標記「會了」或「再練」。</p><div class="bottom"><div class="meter"><i style="width:'+ep+'%"></i></div><span class="pct">'+ep+'%</span></div></a>' +
  '</div><div style="height:70px"></div></div>';
}
const DK = { cat:'ALL', mode:'all', order:[], i:0 };
function buildDeck(startId){
  let list = GRAPES.filter(g => DK.cat==='ALL' || g.catCode===DK.cat);
  if(DK.mode==='again') list = list.filter(g => S.cards[g.id]==='again');
  if(DK.mode==='new') list = list.filter(g => !S.cards[g.id]);
  const ids = list.map(g => g.id);
  for(let i = ids.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [ids[i],ids[j]] = [ids[j],ids[i]]; }
  if(startId != null){ const k = ids.indexOf(+startId); if(k > -1){ ids.splice(k,1); } ids.unshift(+startId); }
  DK.order = ids; DK.i = 0;
}
function mask(g, t){
  let out = String(t);
  [g.main].concat(g.aka).filter(w => w.length > 2).forEach(w => { out = out.replace(new RegExp(reEsc(w),'gi'), '▢▢▢'); });
  return out;
}
function pageCards(startId){
  if(startId != null || !DK.order.length) buildDeck(startId);
  PAGE.innerHTML = folio('cellar','05','Flash <i>Pour</i>','翻牌盲品','看線索、猜品種、翻牌揭曉。按空白鍵翻牌，← 再一次、→ 認得。','Read the clues, name the grape, flip to reveal.', null) + tastingSubnav('cards') +
  '<div class="cp-container deck-wrap"><div>' +
    '<div class="deck-filter"><div class="chip-row" id="dk-cat">'+['ALL'].concat(CAT_ORDER).map(c => '<button class="chip'+(DK.cat===c?' active':'')+'" data-cat="'+c+'">'+(c==='ALL'?'全部 All':'<span class="sw"></span>'+CATS[c].zh)+'</button>').join('')+'</div>' +
    '<div class="seg" id="dk-mode"><button data-m="all" class="'+(DK.mode==='all'?'on':'')+'">All</button><button data-m="new" class="'+(DK.mode==='new'?'on':'')+'">New</button><button data-m="again" class="'+(DK.mode==='again'?'on':'')+'">Again</button></div></div>' +
    '<div id="dk-card"></div></div><aside class="deck-side" id="dk-side"></aside></div>';
  const host = $('#dk-card'), side = $('#dk-side');
  function drawSide(){
    const cs = cardStats();
    side.innerHTML = '<h4>Your palate</h4><span class="jc-label" style="color:var(--ink-faint)">翻牌紀錄</span><div class="big">'+cs.ok+'<span style="font-size:.4em;color:var(--ink-faint)"> / 80</span></div><div class="meter"><i style="width:'+(cs.ok/80*100)+'%"></i></div>' +
      '<div class="row" style="margin-top:16px"><span>認得 Named</span><b>'+cs.ok+'</b></div><div class="row"><span>再一次 Again</span><b>'+cs.again+'</b></div><div class="row"><span>這一輪 This round</span><b>'+Math.min(DK.i+1, DK.order.length)+' / '+DK.order.length+'</b></div>' +
      '<small>紀錄存在這台裝置的瀏覽器裡。Progress is saved in this browser.</small>';
  }
  function drawCard(){
    drawSide();
    if(!DK.order.length){ host.innerHTML = '<div class="book-empty"><span class="jc-label">Empty deck</span><h3>這一疊沒有牌</h3><p>換個篩選條件，或回到「All」。</p></div>'; return; }
    if(DK.i >= DK.order.length){ const cs = cardStats(); host.innerHTML = '<div class="book-empty"><span class="jc-label">Round complete · 這輪結束</span><h3>Cheers!</h3><p>這輪 '+DK.order.length+' 張全部翻完。累計認得 '+cs.ok+' / 80 個品種。</p><button class="jc-btn jc-btn--solid" id="dk-again">再洗一輪 Shuffle again</button></div>'; $('#dk-again').onclick = () => { buildDeck(); drawCard(); }; return; }
    const g = byId(DK.order[DK.i]), c = CATS[g.catCode];
    const clue = (lab, zh, en) => zh || en ? '<div class="clue"><span>'+lab+'</span><div><div class="lang-block zh">'+esc(mask(g,zh||''))+'</div><div class="lang-block en" style="opacity:.8;font-size:13px">'+esc(mask(g,en||''))+'</div></div></div>' : '';
    host.innerHTML = '<div class="flip" id="flip" tabindex="0" role="button" aria-label="翻牌 Flip card"><div class="flip-in">' +
      '<div class="face front"><div class="top"><span>Card '+(DK.i+1)+' / '+DK.order.length+'</span><span>Rack '+c.n+' · '+c.en+'</span></div><h3>Which grape am I?</h3>' +
        clue('Aromas<br>香氣', g.f(6).zh.slice(0,2).join('；'), g.f(6).en.slice(0,2).join('; ')) +
        clue('Places<br>產地', g.f(1).zh.slice(0,2).join('；'), g.f(1).en.slice(0,2).join('; ')) +
        clue('Character<br>特性', g.f(3).zh[0], g.f(3).en[0]) +
        '<div class="hint">點一下翻牌 · Tap to reveal</div></div>' +
      '<div class="face back"><div class="face-top top" style="color:var(--ink-faint)"><span>Rack '+esc(g.rack)+'</span><span>'+(S.cards[g.id]==='ok'?'Named before ✓':'')+'</span></div>'+bottleSVG(g,'No.'+pad(g.no))+'<span class="cat">'+c.zh+' · '+c.en+'</span><h3>'+esc(g.name)+'</h3><a class="link-arrow" href="#/racks/'+g.id+'" onclick="event.stopPropagation()">打開這瓶 Open bottle →</a></div>' +
    '</div></div>' +
    '<div class="deck-actions"><button class="jc-btn again" id="dk-x">← 再一次 Again</button><button class="jc-btn" id="dk-flip">翻牌 Flip</button><button class="jc-btn ok" id="dk-o">認得 Got it →</button></div>';
    const flip = $('#flip');
    const doFlip = () => flip.classList.toggle('on');
    flip.addEventListener('click', doFlip);
    $('#dk-flip').onclick = doFlip;
    $('#dk-x').onclick = () => grade('again');
    $('#dk-o').onclick = () => grade('ok');
    function grade(v){ S.cards[g.id] = v; save(); DK.i++; drawCard(); }
  }
  $('#dk-cat').addEventListener('click', e => { const b = e.target.closest('.chip'); if(!b) return; DK.cat = b.dataset.cat; $$('#dk-cat .chip').forEach(x => x.classList.toggle('active', x===b)); buildDeck(); drawCard(); });
  $('#dk-mode').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; DK.mode = b.dataset.m; $$('#dk-mode button').forEach(x => x.classList.toggle('on', x===b)); buildDeck(); drawCard(); });
  drawCard();
}
document.addEventListener('keydown', e => {
  if(!location.hash.startsWith('#/tasting/cards') || /input|textarea|select/i.test(e.target.tagName) || $('.idx.open')) return;
  if(e.code === 'Space'){ e.preventDefault(); const f = $('#flip'); if(f) f.classList.toggle('on'); }
  if(e.key === 'ArrowLeft'){ const b = $('#dk-x'); if(b) b.click(); }
  if(e.key === 'ArrowRight'){ const b = $('#dk-o'); if(b) b.click(); }
});
function pageExam(n){
  if(n == null){ const q = QS.find(x => S.exam[x.num] !== 'ok') || QS[0]; location.replace('#/tasting/exam/' + q.num); return; }
  n = +n; const q = QS.find(x => x.num === n); if(!q){ location.hash = '#/tasting'; return; }
  const es = examStats();
  PAGE.innerHTML = folio('cellar','05','Written <i>Paper</i>','申論模考','先在紙上寫下你的答案，再展開官方答案對照，誠實地替自己標記。','Write first, then reveal and mark yourself.', [[es.ok+'/'+QS.length,'Nailed'],[es.again,'To review']]) + tastingSubnav('exam');
  showLegacy('exam');
  if(legacyState.exam !== String(n)){ legacyState.exam = String(n); clickLegacy('#exam-sidebar','q',n); }
  const i = QS.indexOf(q), prev = QS[i-1], next = QS[i+1];
  const st = S.exam[n];
  FOOT.innerHTML = '<div class="mark-bar"><span class="q">看完答案後，你這題答得如何？ How did you do on Q'+n+'?</span><div class="btns"><button class="jc-btn again'+(st==='again'?' on':'')+'" data-v="again">↺ 再練一次 Review again</button><button class="jc-btn ok'+(st==='ok'?' on':'')+'" data-v="ok">✓ 我答得出來 Nailed it</button></div></div>' +
    '<nav class="pager" style="margin-top:20px">' + (prev ? '<a href="#/tasting/exam/'+prev.num+'"><span>← Q'+prev.num+'</span><b>'+esc(prev.titleZh)+'</b></a>' : '<span class="empty-slot"></span>') +
    (next ? '<a class="next" href="#/tasting/exam/'+next.num+'"><span>Q'+next.num+' →</span><b>'+esc(next.titleZh)+'</b></a>' : '<span class="empty-slot"></span>') + '</nav>';
  $$('.mark-bar button').forEach(b => b.addEventListener('click', () => {
    S.exam[n] = b.dataset.v; save(); decorateSidebars();
    $$('.mark-bar button').forEach(x => x.classList.toggle('on', x===b));
    toast(b.dataset.v==='ok' ? '漂亮！已標記會了' : '已排進再練清單');
    if(b.dataset.v==='ok' && next) setTimeout(() => { location.hash = '#/tasting/exam/' + next.num; }, 650);
  }));
  decorateSidebars();
}

/* ---------- Cellar Book ---------- */
const SCALE5 = ['low','medium(-)','medium','medium(+)','high'];
const INT5 = ['light','medium(-)','medium','medium(+)','pronounced'];
const COLOURS = { white:['lemon-green','lemon','gold','amber','brown'], rose:['pink','salmon','orange'], red:['purple','ruby','garnet','tawny','brown'] };
const SAT = [
  { k:'appearance', en:'Appearance', zh:'外觀', qs:[
    { k:'clarity', en:'Clarity', zh:'清澈度', o:['clear','hazy (faulty)'] },
    { k:'a_int', en:'Intensity', zh:'顏色深淺', o:['pale','medium','deep'] },
    { k:'colour', en:'Colour', zh:'顏色', o:'colour' } ]},
  { k:'nose', en:'Nose', zh:'香氣', qs:[
    { k:'condition', en:'Condition', zh:'狀態', o:['clean','unclean (faulty)'] },
    { k:'n_int', en:'Intensity', zh:'強度', o:INT5 },
    { k:'development', en:'Development', zh:'發展程度', o:['youthful','developing','fully developed','tired / past its best'] } ]},
  { k:'palate', en:'Palate', zh:'口感', qs:[
    { k:'sweetness', en:'Sweetness', zh:'甜度', o:['dry','off-dry','medium-dry','medium-sweet','sweet','luscious'] },
    { k:'acidity', en:'Acidity', zh:'酸度', o:SCALE5 },
    { k:'tannin', en:'Tannin', zh:'單寧', o:SCALE5 },
    { k:'alcohol', en:'Alcohol', zh:'酒精', o:['low','medium','high'] },
    { k:'body', en:'Body', zh:'酒體', o:['light','medium(-)','medium','medium(+)','full'] },
    { k:'mousse', en:'Mousse', zh:'氣泡', o:['delicate','creamy','aggressive'], sparkling:true },
    { k:'f_int', en:'Flavour intensity', zh:'風味強度', o:INT5 },
    { k:'finish', en:'Finish', zh:'餘韻', o:['short','medium(-)','medium','medium(+)','long'] } ]},
  { k:'conclusions', en:'Conclusions', zh:'結論', qs:[
    { k:'quality', en:'Quality level', zh:'品質等級', o:['faulty','poor','acceptable','good','very good','outstanding'] },
    { k:'readiness', en:'Readiness', zh:'適飲程度', o:['too young','can drink now, but has potential for ageing','drink now: not suitable for ageing','too old'] } ]}
];
const AROMAS = {
  p:{ en:'Primary', zh:'一類', o:['citrus','green fruit','stone fruit','tropical fruit','red fruit','black fruit','dried fruit','floral','herbaceous','herbal','pungent spice','mineral'] },
  s:{ en:'Secondary', zh:'二類', o:['yeast / lees','butter / cream','vanilla','toast','cedar','smoke','sweet spice','coconut'] },
  t:{ en:'Tertiary', zh:'三類', o:['dried fruit','leather','earth','mushroom','forest floor','tobacco','honey','petrol','nutty','caramel','coffee'] }
};
const fmtDate = ts => { const d = new Date(ts); return { d:d.getDate(), m:d.toLocaleString('en',{month:'short'}), full:d.toLocaleDateString('zh-TW',{year:'numeric',month:'long',day:'numeric'}) }; };
function bookList(activeId){
  return '<aside class="book-list"><a class="jc-btn jc-btn--solid" href="#/book/new">＋ 寫一頁 New tasting note</a>' +
    S.book.slice().sort((a,b)=>b.created-a.created).map(e => { const d = fmtDate(e.date || e.created); return '<a class="entry-tab'+(e.id===activeId?' on':'')+'" href="#/book/'+e.id+'"><div class="dt"><b>'+d.d+'</b><span>'+d.m+'</span></div><div><div class="nm">'+esc(e.wine.name || 'Untitled wine')+'</div><div class="sub">'+esc([e.wine.vintage, e.wine.producer, e.wine.region].filter(Boolean).join(' · '))+'</div></div></a>'; }).join('') +
    '<div class="table-teaser" style="grid-template-columns:1fr"><div><span class="soon">Coming next · 即將推出</span><h4>The Tasting Table</h4><p>酒友桌：登入後分享筆記、互相乾杯 🥂、留言，並排比較同一支酒的 SAT 判斷。</p></div></div></aside>';
}
function bookFolio(){
  return folio('paper','06','The Cellar <i>Book</i>','酒窖簿',
    '舊時酒窖主人會用一本簿子記下每瓶酒。這裡是你的：用 WSET SAT 格式記錄每一支喝過的酒。',
    'A cellar book, the old way — one page per bottle, written in the language of the SAT.', [[S.book.length,'Pages written']]);
}
function pageBook(id){
  if(!S.book.length && !id){
    PAGE.innerHTML = bookFolio() + '<div class="cp-container book-wrap" style="grid-template-columns:1fr"><div class="book-empty"><span class="jc-label">Page one</span><h3>還是一本空白的酒窖簿</h3><p>下一次開瓶時，用 SAT 的四個段落——外觀、香氣、口感、結論——寫下你的判斷。點選就好，不用打一堆字。</p><a class="jc-btn jc-btn--solid" href="#/book/new">寫下第一頁 Write the first page</a></div></div>';
    return;
  }
  const e = id ? S.book.find(x => x.id === id) : S.book.slice().sort((a,b)=>b.created-a.created)[0];
  if(!e){ location.hash = '#/book'; return; }
  PAGE.innerHTML = bookFolio() + '<div class="cp-container book-wrap">' + bookList(e.id) + '<div>' + sheetHTML(e) + '</div></div>';
  $('#copy-note').onclick = () => {
    const txt = noteText(e);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('已複製，可以貼給酒友 · Copied'), () => { prompt('複製以下內容 Copy:', txt); });
  };
  const del = $('#del-note');
  del.onclick = () => {
    if(del.dataset.arm){ S.book = S.book.filter(x => x.id !== e.id); save(); toast('已刪除這一頁'); location.hash = '#/book'; return; }
    del.dataset.arm = '1'; del.textContent = '再按一次確認刪除 Confirm'; setTimeout(() => { if(del.isConnected){ delete del.dataset.arm; del.textContent = '刪除 Delete'; } }, 3000);
  };
}
function scaleBar(q, v){
  if(!Array.isArray(q.o) || q.o.length < 4) return '';
  const i = q.o.indexOf(v); if(i < 0) return '';
  return '<div class="scale">'+q.o.map((_,k) => '<i class="'+(k<=i?'f':'')+'"></i>').join('')+'</div>';
}
function sheetHTML(e){
  const d = fmtDate(e.date || e.created);
  const col = sec => '<div class="sat-col"><h4>'+sec.en+'<small>'+sec.zh+'</small></h4>' +
    sec.qs.filter(q => !q.sparkling || e.wine.sparkling).map(q => { const v = e.sat[q.k]; return '<div class="sat-kv"><span>'+q.en+' · '+q.zh+'</span><b class="'+(v?'':'none')+'">'+esc(v || '—')+'</b>'+scaleBar(q,v)+'</div>'; }).join('') +
    (sec.k==='nose' ? '<div class="sat-kv"><span>Aromas · 香氣特徵</span><b class="'+(aromaStr(e)?'':'none')+'">'+esc(aromaStr(e) || '—')+'</b></div>' : '') +
    (sec.k==='palate' && e.flavourText ? '<div class="sat-kv"><span>Flavours · 風味特徵</span><b>'+esc(e.flavourText)+'</b></div>' : '') + '</div>';
  const g = GRAPES.find(x => e.wine.grape && x.name.toLowerCase().includes(e.wine.grape.toLowerCase()));
  return '<article class="sheet fade-in"><div class="sheet-head"><div><span class="jc-label">Cellar Book · '+esc(d.full)+' · '+esc(typeLabel(e.wine))+'</span><h2>'+esc(e.wine.name || 'Untitled wine')+'</h2><div class="who">'+esc([e.wine.producer, e.wine.region, e.wine.grape].filter(Boolean).join(' · '))+(g ? ' · <a class="link-arrow" href="#/racks/'+g.id+'">'+esc(g.main)+' on the racks →</a>' : '')+'</div></div><div class="vint">'+esc(e.wine.vintage || 'NV')+'<small>Vintage</small></div></div>' +
    '<div class="sat-grid">'+SAT.map(col).join('')+'</div>' +
    (e.notes ? '<div class="sheet-notes"><span class="jc-label">Notes · 心得</span>'+esc(e.notes).replace(/\n/g,'<br>')+'</div>' : '') +
    (e.wine.place || e.wine.with || e.wine.price ? '<div class="sheet-notes" style="font-size:12.5px;color:var(--ink-dim)">'+esc([e.wine.place && ('📍 '+e.wine.place), e.wine.with && ('🥂 '+e.wine.with), e.wine.price && ('💰 '+e.wine.price)].filter(Boolean).join('　'))+'</div>' : '') +
    '<div class="sheet-actions"><a class="jc-btn" href="#/book/'+e.id+'/edit">編輯 Edit</a><button class="jc-btn" id="copy-note" type="button">複製文字分享 Copy to share</button><button class="jc-btn" id="del-note" type="button" style="margin-left:auto">刪除 Delete</button></div></article>';
}
const typeLabel = w => ({white:'White 白酒', rose:'Rosé 粉紅酒', red:'Red 紅酒'}[w.type] || '') + (w.sparkling ? ' · Sparkling 氣泡' : '');
const aromaStr = e => [].concat(e.aromas.p||[], e.aromas.s||[], e.aromas.t||[]).concat(e.aromaText ? [e.aromaText] : []).join(', ');
function noteText(e){
  const lines = ['🍷 ' + (e.wine.name||'') + ' ' + (e.wine.vintage||''), [e.wine.producer, e.wine.region, e.wine.grape].filter(Boolean).join(' · ')];
  SAT.forEach(sec => { lines.push('', '【'+sec.en+' '+sec.zh+'】'); sec.qs.filter(q => !q.sparkling || e.wine.sparkling).forEach(q => { if(e.sat[q.k]) lines.push(q.en+': '+e.sat[q.k]); }); if(sec.k==='nose' && aromaStr(e)) lines.push('Aromas: '+aromaStr(e)); if(sec.k==='palate' && e.flavourText) lines.push('Flavours: '+e.flavourText); });
  if(e.notes) lines.push('', e.notes);
  lines.push('', '— from my Cellar & Paper 酒窖簿');
  return lines.join('\n');
}
function pageBookForm(id){
  const ex = id ? S.book.find(x => x.id === id) : null;
  const e = ex ? JSON.parse(JSON.stringify(ex)) : { id:'n'+Date.now().toString(36), created:Date.now(), date:Date.now(), wine:{ type:'red', sparkling:false }, sat:{}, aromas:{p:[],s:[],t:[]}, aromaText:'', flavourText:'', notes:'' };
  const dateVal = new Date(e.date || e.created); const dv = dateVal.getFullYear()+'-'+pad(dateVal.getMonth()+1)+'-'+pad(dateVal.getDate());
  const inp = (k, lab, ph, extra) => '<div class="field-in '+(extra||'')+'"><label for="w-'+k+'">'+lab+'</label><input id="w-'+k+'" data-w="'+k+'" value="'+esc(e.wine[k]||'')+'" placeholder="'+esc(ph||'')+'"'+(k==='grape'?' list="dl-grapes"':k==='region'?' list="dl-regions"':'')+'></div>';
  PAGE.innerHTML = bookFolio() + '<div class="cp-container book-wrap">' + bookList(ex ? ex.id : null) + '<div><form class="form-sheet fade-in" id="note-form" autocomplete="off">' +
    '<div class="fs"><div class="fs-h"><span class="n">0</span><h3>The bottle<small>酒款資料</small></h3></div><div class="f-grid">' +
      inp('name','酒名 Wine *','e.g. Château Talbot','full') + inp('producer','酒莊 Producer','') + inp('vintage','年份 Vintage','2018 / NV') +
      inp('region','產區 Region','Saint-Julien, Bordeaux') + inp('grape','品種 Grape','Cabernet Sauvignon') +
      '<div class="field-in"><label>類型 Type</label><div class="opts" id="w-type">'+[['white','White 白'],['rose','Rosé 粉紅'],['red','Red 紅']].map(t => '<button type="button" class="opt'+(e.wine.type===t[0]?' on':'')+'" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'<button type="button" class="opt'+(e.wine.sparkling?' on':'')+'" id="w-spark">Sparkling 氣泡</button></div></div>' +
      '<div class="field-in"><label for="w-date">品飲日期 Date</label><input type="date" id="w-date" value="'+dv+'"></div>' +
      inp('place','地點 Where','') + inp('with','和誰 With','') + inp('price','價格 Price','') +
    '</div></div>' +
    SAT.map((sec,si) => '<div class="fs" data-sec="'+sec.k+'"><div class="fs-h"><span class="n">'+(si+1)+'</span><h3>'+sec.en+'<small>'+sec.zh+'</small></h3></div>' +
      sec.qs.map(q => '<div class="scale-q" data-q="'+q.k+'"'+(q.sparkling && !e.wine.sparkling ? ' hidden' : '')+'><label>'+q.en+' · '+q.zh+'</label><div class="opts">'+(q.o==='colour' ? '' : q.o.map(o => '<button type="button" class="opt'+(e.sat[q.k]===o?' on':'')+'" data-v="'+esc(o)+'">'+esc(o)+'</button>').join(''))+'</div></div>').join('') +
      (sec.k==='nose' ? '<div class="scale-q"><label>Aroma characteristics · 香氣特徵</label><div class="aroma-box">'+Object.keys(AROMAS).map(k => '<div class="aroma-col" data-a="'+k+'"><h5>'+AROMAS[k].en+' · '+AROMAS[k].zh+'</h5><div class="opts">'+AROMAS[k].o.map(o => '<button type="button" class="opt'+((e.aromas[k]||[]).includes(o)?' on':'')+'" data-v="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div></div>').join('')+'</div><div class="field-in" style="margin-top:12px"><input id="w-aromaText" value="'+esc(e.aromaText)+'" placeholder="更具體的描述，例如：blackcurrant, violet, pencil shavings"></div></div>' : '') +
      (sec.k==='palate' ? '<div class="scale-q"><label>Flavour characteristics · 風味特徵</label><div class="field-in"><input id="w-flavourText" value="'+esc(e.flavourText)+'" placeholder="e.g. blackcurrant, cedar, graphite"></div></div>' : '') +
    '</div>').join('') +
    '<div class="fs"><div class="fs-h"><span class="n">5</span><h3>Notes<small>心得</small></h3></div><div class="field-in"><textarea id="w-notes" placeholder="搭配的菜、當下的感覺、和 SAT 對不上的地方…">'+esc(e.notes)+'</textarea></div></div>' +
    '<div class="form-foot"><a class="jc-btn" href="'+(ex ? '#/book/'+ex.id : '#/book')+'">取消 Cancel</a><button class="jc-btn jc-btn--solid" type="submit">收進酒窖簿 Save page</button></div>' +
  '</form></div></div>' +
  '<datalist id="dl-grapes">'+GRAPES.map(g => '<option value="'+esc(g.name)+'">').join('')+'</datalist><datalist id="dl-regions">'+REGION_LIST.map(r => '<option value="'+esc(r.region.en)+'">').join('')+'</datalist>';

  const form = $('#note-form');
  function drawColours(){
    const box = $('[data-q="colour"] .opts', form);
    box.innerHTML = COLOURS[e.wine.type].map(o => '<button type="button" class="opt'+(e.sat.colour===o?' on':'')+'" data-v="'+o+'">'+o+'</button>').join('');
  }
  drawColours();
  $('#w-type').addEventListener('click', ev => {
    const b = ev.target.closest('.opt'); if(!b) return;
    if(b.id === 'w-spark'){ e.wine.sparkling = !e.wine.sparkling; b.classList.toggle('on', e.wine.sparkling); $('[data-q="mousse"]', form).hidden = !e.wine.sparkling; return; }
    e.wine.type = b.dataset.v; $$('#w-type .opt:not(#w-spark)').forEach(x => x.classList.toggle('on', x===b));
    if(!COLOURS[e.wine.type].includes(e.sat.colour)) delete e.sat.colour; drawColours();
  });
  form.addEventListener('click', ev => {
    const b = ev.target.closest('.opt'); if(!b || b.closest('#w-type')) return;
    const sq = b.closest('.scale-q[data-q]'), ac = b.closest('.aroma-col');
    if(ac){ const k = ac.dataset.a, v = b.dataset.v, arr = e.aromas[k] = e.aromas[k] || []; const i = arr.indexOf(v); if(i>-1) arr.splice(i,1); else arr.push(v); b.classList.toggle('on', i<0); return; }
    if(sq){ const k = sq.dataset.q, v = b.dataset.v; e.sat[k] = e.sat[k]===v ? undefined : v; $$('.opt', sq).forEach(x => x.classList.toggle('on', x.dataset.v === e.sat[k])); }
  });
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    $$('[data-w]', form).forEach(i => e.wine[i.dataset.w] = i.value.trim());
    if(!e.wine.name){ $('#w-name').focus(); toast('請先填酒名 · Name the wine first'); return; }
    const dv2 = $('#w-date').value; if(dv2) e.date = new Date(dv2+'T12:00:00').getTime();
    e.aromaText = $('#w-aromaText').value.trim(); e.flavourText = $('#w-flavourText').value.trim(); e.notes = $('#w-notes').value.trim();
    Object.keys(e.sat).forEach(k => { if(e.sat[k] === undefined) delete e.sat[k]; });
    e.updated = Date.now();
    S.book = S.book.filter(x => x.id !== e.id).concat(e); save();
    toast('已收進酒窖簿 · Saved'); location.hash = '#/book/' + e.id;
  });
}

/* ---------- My Cellar ---------- */
function pageMy(){
  const cs = cardStats(), es = examStats();
  const kept = S.kept.map(byId).filter(Boolean);
  const lastCh = CHAPTERS.find(c => c.num === S.last);
  PAGE.innerHTML = folio('cellar','07','My <i>Cellar</i>','我的酒窖',
    '你收進來的每一瓶、讀過的每一章、翻過的每張牌，都存放在這裡。',
    'Everything you have kept, read and tasted — in one cellar.', null) +
  '<div class="cp-container"><div class="stat-cards">' +
    '<a class="stat-card" href="#/manuscripts">'+ringHTML(S.read.length,45,S.read.length)+'<h4>Manuscripts read<small>已讀手稿</small></h4><span class="sub">of 45 chapters</span></a>' +
    '<a class="stat-card" href="#/racks">'+ringHTML(kept.length,80,kept.length)+'<h4>Bottles kept<small>收藏品種</small></h4><span class="sub">of 80 bottles</span></a>' +
    '<a class="stat-card" href="#/tasting/cards">'+ringHTML(cs.ok,80,cs.ok)+'<h4>Bottles named<small>翻牌認得</small></h4><span class="sub">'+cs.again+' to try again</span></a>' +
    '<a class="stat-card" href="#/tasting/exam">'+ringHTML(es.ok,QS.length,es.ok)+'<h4>Papers nailed<small>申論會了</small></h4><span class="sub">of '+QS.length+' · '+es.again+' to review</span></a>' +
    '<a class="stat-card" href="#/book">'+ringHTML(S.book.length, Math.max(10, S.book.length), S.book.length)+'<h4>Cellar Book<small>酒窖簿</small></h4><span class="sub">pages written</span></a>' +
  '</div>' +
  (lastCh ? '<a class="mini-card" style="margin-bottom:30px" href="#/manuscripts/'+lastCh.num+'"><span class="go">→</span><span class="jc-label">Continue reading · 繼續閱讀</span><h4>Ch'+lastCh.num+'. '+esc(lastCh.titleZh)+'</h4><span class="en">'+esc(lastCh.titleEn)+'</span></a>' : '') +
  '<div class="section-title"><h2>Kept bottles<small>我收藏的酒</small></h2><a class="link-arrow" href="#/racks">Browse the racks →</a></div>' +
  (kept.length ? '<div class="kept-shelf"><div class="shelf">'+kept.map(slotHTML).join('')+'</div></div>' : '<div class="book-empty"><h3>酒窖還是空的</h3><p>在任何一瓶的頁面按「收進我的酒窖」，它就會出現在這裡。</p><a class="jc-btn" href="#/racks">去逛酒架 Browse the racks</a></div>') +
  '<div class="backup"><span>你的紀錄只存在這台裝置的瀏覽器。換裝置前可以先備份：</span><button class="jc-btn" id="bk-out">備份下載 Export</button><label class="jc-btn" style="cursor:pointer">匯入備份 Import<input type="file" id="bk-in" accept="application/json" hidden></label></div></div>';
  $('#bk-out').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cellar-and-paper-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#bk-in').onchange = ev => {
    const f = ev.target.files[0]; if(!f) return;
    f.text().then(t => { const d = JSON.parse(t); S = Object.assign(DEF(), d); save(); toast('已匯入備份 · Imported'); pageMy(); }).catch(() => toast('檔案格式不正確 · Invalid file'));
  };
}

/* =========================================================
   ROUTER
   ========================================================= */
function parse(){
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(qs || '');
  return { seg, params };
}
function setNav(top){
  $$('.cp-links a, .cp-drawer a[data-top]').forEach(a => a.classList.toggle('on', a.dataset.top === top));
}
let lastTop = null;
function route(){
  const { seg, params } = parse();
  const top = seg[0] || 'home';
  showLegacy(null); FOOT.innerHTML = ''; if(spyObs) spyObs.disconnect();
  $('.cp-drawer').classList.remove('open');
  switch(top){
    case 'racks': seg[1] != null ? pageBottle(seg[1]) : pageRacks(); break;
    case 'manuscripts': seg[1] ? pageChapter(seg[1]) : pageManuscripts(); break;
    case 'maps': seg[1] ? pageRegion(seg[1]) : pageMaps(); break;
    case 'outlines': seg[1] ? pageOutline(seg[1]) : pageOutlines(); break;
    case 'tasting':
      if(seg[1]==='cards') pageCards(params.get('start'));
      else if(seg[1]==='exam') pageExam(seg[2]);
      else pageTasting();
      break;
    case 'book':
      if(seg[1]==='new') pageBookForm();
      else if(seg[2]==='edit') pageBookForm(seg[1]);
      else pageBook(seg[1]);
      break;
    case 'my': pageMy(); break;
    default: pageHome();
  }
  setNav(top);
  const titles = { home:'', racks:'The Racks 酒架', manuscripts:'Manuscripts 手稿', maps:'Terroir Maps 風土地圖', outlines:'Outlines 綱要', tasting:'Blind Tasting 盲品', book:'Cellar Book 酒窖簿', my:'My Cellar 我的酒窖' };
  document.title = (titles[top] ? titles[top] + ' · ' : '') + 'Cellar & Paper 酒窖與紙張';
  PAGE.classList.remove('fade-in'); void PAGE.offsetWidth; PAGE.classList.add('fade-in');
  window.scrollTo(0, 0);
  lastTop = top;
  onScroll();
}
window.addEventListener('hashchange', route);

/* reading progress */
function onScroll(){
  const { seg } = parse();
  const reading = (seg[0]==='manuscripts' && seg[1]) || (seg[0]==='racks' && seg[1] != null) || (seg[0]==='maps' && seg[1]);
  if(!reading){ PROG.style.width = '0'; return; }
  const max = document.documentElement.scrollHeight - innerHeight;
  PROG.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + '%';
}
window.addEventListener('scroll', onScroll, { passive:true });

/* ---------- nav chrome ---------- */
$('#menu-open').addEventListener('click', () => $('.cp-drawer').classList.add('open'));
$('#menu-close').addEventListener('click', () => $('.cp-drawer').classList.remove('open'));
$$('.lang-toggle button').forEach(b => b.addEventListener('click', () => {
  $$('.lang-toggle button').forEach(x => x.classList.toggle('active', x.dataset.lang === b.dataset.lang));
  S.prefs.lang = b.dataset.lang; save();
}));
if(S.prefs.lang && S.prefs.lang !== 'both'){ const b = $('.lang-toggle button[data-lang="'+S.prefs.lang+'"]'); if(b) b.click(); }
$$('.theme-btn').forEach(b => b.addEventListener('click', () => {
  const r = document.documentElement, d = r.getAttribute('data-theme') === 'dark';
  if(d) r.removeAttribute('data-theme'); else r.setAttribute('data-theme','dark');
  try { localStorage.setItem('jc-theme', d ? 'light' : 'dark'); } catch(e){}
}));

/* ---------- Index (global search) ---------- */
const IDX = [];
GRAPES.forEach(g => IDX.push({ g:'Bottles · 酒架', t:g.name, s:'Rack '+g.rack+' · '+CATS[g.catCode].zh, h:'#/racks/'+g.id, k:(g.name+' '+g.catZh).toLowerCase() }));
CHAPTERS.forEach(c => IDX.push({ g:'Manuscripts · 手稿', t:'Ch'+c.num+'. '+c.titleZh, s:c.titleEn, h:'#/manuscripts/'+c.num, k:(c.titleZh+' '+c.titleEn+' ch'+c.num).toLowerCase() }));
REGION_LIST.forEach(e => IDX.push({ g:'Terroir Maps · 風土地圖', t:e.region.zh+' '+e.region.en, s:e.country.en, h:regionUrl(e.key), k:(e.region.zh+' '+e.region.en+' '+e.country.zh+' '+e.country.en+' '+e.region.plots.map(p=>p.en+' '+p.zh).join(' ')).toLowerCase() }));
FWS.forEach(f => IDX.push({ g:'Outlines · 綱要', t:f.titleZh, s:'Framework '+ROMAN[f.num], h:'#/outlines/'+f.num, k:(f.titleZh+' '+f.titleEn).toLowerCase() }));
QS.forEach(q => IDX.push({ g:'Blind papers · 申論', t:'Q'+q.num+'. '+q.titleZh, s:q.titleEn, h:'#/tasting/exam/'+q.num, k:(q.titleZh+' '+q.titleEn).toLowerCase() }));
const idxEl = $('.idx'), idxIn = $('#idx-q'), idxRes = $('#idx-res');
let idxSel = 0, idxItems = [];
function openIdx(){ idxEl.classList.add('open'); idxIn.value = ''; drawIdx(); setTimeout(() => idxIn.focus(), 30); }
function closeIdx(){ idxEl.classList.remove('open'); }
function drawIdx(){
  const q = idxIn.value.trim().toLowerCase();
  const book = S.book.map(e => ({ g:'Cellar Book · 酒窖簿', t:e.wine.name, s:[e.wine.vintage,e.wine.producer].filter(Boolean).join(' · '), h:'#/book/'+e.id, k:(e.wine.name+' '+(e.wine.producer||'')+' '+(e.wine.grape||'')).toLowerCase() }));
  let list = q ? IDX.concat(book).filter(x => x.k.includes(q)) : IDX.filter(x => x.g.startsWith('Bottles')).slice(0,0);
  list = list.slice(0, 40);
  if(q){
    list.push({ g:'Full text · 全文搜尋', t:'在手稿全文搜尋「'+idxIn.value.trim()+'」', s:'Manuscripts', act:'notes' });
    list.push({ g:'Full text · 全文搜尋', t:'在風土地圖全文搜尋「'+idxIn.value.trim()+'」', s:'Terroir Maps', act:'regions' });
    list.push({ g:'Full text · 全文搜尋', t:'在酒架全文搜尋「'+idxIn.value.trim()+'」', s:'The Racks', act:'racks' });
  }
  idxItems = list; idxSel = 0;
  if(!q){ idxRes.innerHTML = '<div class="idx-empty">輸入品種、產區、章節或題目… Type a grape, region, chapter or question.<br><br>快捷鍵：按 <b>/</b> 或 <b>⌘K</b> 隨時打開索引</div>'; return; }
  let html = '', g = '';
  list.forEach((x,i) => { if(x.g !== g){ g = x.g; html += '<div class="idx-g">'+esc(g)+'</div>'; } html += '<a href="'+(x.h||'#')+'" data-i="'+i+'" class="'+(i===0?'sel':'')+'"><b>'+esc(x.t)+'</b><span>'+esc(x.s||'')+'</span></a>'; });
  idxRes.innerHTML = html;
}
function goIdx(i){
  const x = idxItems[i]; if(!x) return; const q = idxIn.value.trim(); closeIdx();
  if(x.act === 'racks'){ RS.q = q; RS.cat = 'ALL'; location.hash = '#/racks'; if(location.hash === '#/racks') route(); return; }
  if(x.act){
    const target = x.act === 'notes' ? '#/manuscripts/' + (S.last || 1) : regionUrl(REGION_LIST[0].key);
    if(location.hash !== target) location.hash = target;
    setTimeout(() => { const inp = $(x.act === 'notes' ? '#notes-search' : '#region-search'); if(inp){ inp.value = q; inp.dispatchEvent(new Event('input')); } }, 60);
    return;
  }
  location.hash = x.h;
}
idxIn.addEventListener('input', drawIdx);
idxIn.addEventListener('keydown', e => {
  const links = $$('#idx-res a');
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); idxSel = Math.max(0, Math.min(links.length-1, idxSel + (e.key==='ArrowDown'?1:-1))); links.forEach((l,i) => l.classList.toggle('sel', i===idxSel)); if(links[idxSel]) links[idxSel].scrollIntoView({ block:'nearest' }); }
  if(e.key === 'Enter'){ e.preventDefault(); goIdx(idxSel); }
});
idxRes.addEventListener('click', e => { const a = e.target.closest('a'); if(!a) return; e.preventDefault(); goIdx(+a.dataset.i); });
idxEl.addEventListener('click', e => { if(e.target === idxEl) closeIdx(); });
$$('.open-idx').forEach(b => b.addEventListener('click', openIdx));
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ closeIdx(); $('.cp-drawer').classList.remove('open'); }
  if((e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')){ e.preventDefault(); openIdx(); }
});

route();
})();
