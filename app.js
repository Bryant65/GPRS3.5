const $=id=>document.getElementById(id);
const fields=['ticker','company','industry','price','market','peNow','yieldNow','pbNow','latestRevenue','momRevenue','yoyRevenue','officialUpdated','business','customers','revCagr','epsCagr','ttmYoY','roe','roic','gm','om','debtRatio','ocf','fcf','contract','working','industryGrowth','moat','stickiness','management','guidance','valuationScore','conference','material','y1Revenue','y1Eps','y1Gm','y1Driver','y2Revenue','y2Eps','y2Gm','y2Driver','y3Revenue','y3Eps','y3Gm','y3Driver','epsBear','epsBase','epsBull','peBear','peBase','peBull','institutional','ownership','marketPricing','growthDrivers','verification','risks','conclusion'];
const n=id=>Number($(id).value||0),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const money=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0}).format(v)+' 元';
const scorePct=(v,low,high,max)=>v<=low?clamp((v/Math.max(low,1))*max*.5,0,max):clamp(max*.5+(v-low)/(high-low)*max*.5,0,max);
function getData(){let d={};fields.forEach(f=>d[f]=$(f).value);return d}
function setData(d){fields.forEach(f=>$(f).value=d?.[f]??'');calculate()}
function calc(){
  const debtQuality=clamp(10-(Math.max(0,n('debtRatio')-20)/8),0,10);
  const financial=
    scorePct(n('roe'),8,25,6)+scorePct(n('roic'),6,20,5)+scorePct(n('gm'),20,60,4)+scorePct(n('om'),8,30,4)+
    clamp(n('ocf'),0,10)*.3+clamp(n('fcf'),0,10)*.3+clamp(n('contract'),0,10)*.25+clamp(n('working'),0,10)*.1+debtQuality*.05;
  const growth=scorePct(n('revCagr'),0,25,8)+scorePct(n('epsCagr'),0,30,8)+scorePct(n('ttmYoY'),0,25,4)+clamp(n('industryGrowth'),0,10)*.5;
  const moat=clamp(n('moat'),0,10)*1.2+clamp(n('stickiness'),0,10)*.8;
  const management=clamp(n('management'),0,10)*.6+clamp(n('guidance'),0,10)*.4;
  const valuation=clamp(n('valuationScore'),0,10)*1.5;
  const total=Math.round(financial+growth+moat+management+valuation);
  let grade='D';if(total>=90)grade='A+';else if(total>=80)grade='A';else if(total>=70)grade='B';else if(total>=60)grade='C';
  const fairBear=n('epsBear')*n('peBear'),fairBase=n('epsBase')*n('peBase'),fairBull=n('epsBull')*n('peBull');
  return {financial,growth,moat,management,valuation,total,grade,fairBear,fairBase,fairBull};
}
function calculate(){
  const r=calc();$('totalScore').textContent=r.total;$('grade').textContent=r.grade;
  $('bearPrice').textContent=money(r.fairBear);$('basePrice').textContent=money(r.fairBase);$('bullPrice').textContent=money(r.fairBull);
  const p=n('price');$('pricePosition').textContent=!p||!r.fairBase?'—':(p<r.fairBear?'低於保守價':p<r.fairBase?'保守～中性':p<r.fairBull?'中性～樂觀':'高於樂觀價');
  const parts=[['sf',r.financial,30],['sg',r.growth,25],['sm',r.moat,20],['sman',r.management,10],['sv',r.valuation,15]];
  parts.forEach(([id,val,max])=>{$(id+'Text').textContent=`${val.toFixed(1)} / ${max}`;$(id+'Bar').style.width=`${val/max*100}%`});
  return r;
}

let GPRS_DATA_CACHE=null;
const cleanNum=v=>{if(v===null||v===undefined)return '';const s=String(v).replace(/,/g,'').replace(/%/g,'').trim();if(['','--','---','N/A','-'].includes(s))return '';const x=Number(s);return Number.isFinite(x)?x:''};
const pick=(o,names)=>{for(const k of names){if(o&&o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return o[k]}return ''};
function setIf(id,val,overwrite=true){if(val===''||val===null||val===undefined||!$(id))return;if(overwrite||!$(id).value)$(id).value=val}
async function loadFundamentalDB(force=false){if(GPRS_DATA_CACHE&&!force)return GPRS_DATA_CACHE;const r=await fetch('./data/fundamentals.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('fundamentals.json 尚未建立');GPRS_DATA_CACHE=await r.json();return GPRS_DATA_CACHE}
function parseFinancials(d){const i=d.income||{},b=d.balance||{};const revenue=cleanNum(pick(i,['營業收入','營業收入合計','Revenue','收益']));const gross=cleanNum(pick(i,['營業毛利（毛損）','營業毛利（毛損）淨額','營業毛利','GrossProfit']));const op=cleanNum(pick(i,['營業利益（損失）','營業利益','OperatingIncome']));const eps=cleanNum(pick(i,['基本每股盈餘（元）','基本每股盈餘','BasicEarningsPerShare']));const equity=cleanNum(pick(b,['權益總額','權益總計','Equity']));const assets=cleanNum(pick(b,['資產總額','資產總計','Assets']));const liabilities=cleanNum(pick(b,['負債總額','負債總計','Liabilities']));const net=cleanNum(pick(i,['本期淨利（淨損）','本期淨利','稅後淨利','ProfitLoss']));if(revenue&&gross!=='')setIf('gm',(gross/revenue*100).toFixed(1),false);if(revenue&&op!=='')setIf('om',(op/revenue*100).toFixed(1),false);if(assets&&liabilities!=='')setIf('debtRatio',(liabilities/assets*100).toFixed(1),false);if(equity&&net!=='')setIf('roe',(net/equity*100).toFixed(1),false);if(eps!==''){setIf('y1Eps',eps,false);setIf('epsBase',eps,false)}}
async function fetchOfficialData(){const ticker=$('ticker').value.trim();if(!/^\d{4,6}$/.test(ticker)){alert('請輸入股票代號，例如 3563');return}$('fetchBtn').disabled=true;$('fetchMessage').textContent='正在讀取 GPRS 官方資料庫…';try{const db=await loadFundamentalDB(true);const d=db.companies?.[ticker];if(!d)throw new Error('資料庫目前查無此代號；請先執行 GitHub Actions 更新');const q=d.quote||{},v=d.valuation||{},c=d.company||{},r=d.revenue||{};setIf('market',d.market);setIf('company',pick(q,['Name','證券名稱'])||pick(c,['公司簡稱','公司名稱','CompanyName']));setIf('industry',pick(c,['產業別','產業類別','Industry']));setIf('price',cleanNum(pick(q,['ClosingPrice','收盤價','Close','ClosePrice'])));setIf('peNow',cleanNum(pick(v,['PEratio','本益比','P/E','PERatio'])));setIf('yieldNow',cleanNum(pick(v,['DividendYield','殖利率(%)','殖利率','Yield'])));setIf('pbNow',cleanNum(pick(v,['PBratio','股價淨值比','PBRatio'])));setIf('latestRevenue',pick(r,['當月營收','營業收入-當月營收','CurrentMonthRevenue']));setIf('momRevenue',cleanNum(pick(r,['上月比較增減(%)','營業收入-上月比較增減(%)','MoM','月增率'])));const yoy=cleanNum(pick(r,['去年同月增減(%)','營業收入-去年同月增減(%)','YoY','年增率']));setIf('yoyRevenue',yoy);setIf('ttmYoY',yoy,false);setIf('officialUpdated',db.meta?.updated_at_taipei||'');parseFinancials(d);calculate();$('fetchMessage').textContent=`完成：${d.market}官方基本面資料已填入。`;if($('apiStatus'))$('apiStatus').textContent='V4 官方資料橋接'}catch(e){$('fetchMessage').textContent='尚未取得資料。請先在 GitHub Actions 執行一次更新。';alert(e.message)}finally{$('fetchBtn').disabled=false}}

function loadAll(){return JSON.parse(localStorage.getItem('bryant_gprs_v3')||'{}')}
function storeAll(x){localStorage.setItem('bryant_gprs_v3',JSON.stringify(x));renderAll()}
function saveCompany(){
  const d=getData();if(!d.ticker){alert('請輸入股票代號');return}
  d.result=calculate();d.updatedAt=new Date().toISOString();const all=loadAll();all[d.ticker]=d;storeAll(all);alert('研究已儲存');
}
function newResearch(){setData({});switchTab('research');scrollTo({top:0,behavior:'smooth'})}
function loadCompany(t){const d=loadAll()[t];if(d){setData(d);switchTab('research');scrollTo({top:0,behavior:'smooth'})}}
function removeCompany(t){if(confirm(`刪除 ${t}？`)){const a=loadAll();delete a[t];storeAll(a)}}
function renderAll(){
  const a=Object.values(loadAll()).sort((x,y)=>(y.updatedAt||'').localeCompare(x.updatedAt||''));
  $('dashCount').textContent=a.length;$('dashAvg').textContent=a.length?Math.round(a.reduce((s,d)=>s+(d.result?.total||0),0)/a.length):'—';
  $('dashA').textContent=a.filter(d=>['A','A+'].includes(d.result?.grade)).length;
  $('dashUpdated').textContent=a[0]?.updatedAt?new Date(a[0].updatedAt).toLocaleDateString('zh-TW'):'—';
  const list=a.slice(0,5).map(d=>`<div class="watch"><div><b>${d.ticker} ${d.company||''}</b><div class="muted small">${d.industry||''}</div></div><div><span class="pill">${d.result?.grade||'—'}｜${d.result?.total||'—'} 分</span> <button class="secondary" onclick="loadCompany('${d.ticker}')">開啟</button></div></div>`).join('');
  $('recentList').innerHTML=list||'<p class="muted">尚未建立研究。</p>';
  $('watchList').innerHTML=a.map(d=>`<div class="watch"><div><b>${d.ticker} ${d.company||''}</b><div class="muted small">${d.industry||''}<br>中性合理價：${money(d.result?.fairBase||0)}</div></div><div><span class="pill">${d.result?.grade||'—'}｜${d.result?.total||'—'} 分</span><br><button class="secondary" onclick="loadCompany('${d.ticker}')">開啟</button> <button class="danger" onclick="removeCompany('${d.ticker}')">刪除</button></div></div>`).join('')||'<p class="muted">尚未加入公司。</p>';
  if(!a.length){$('compareTable').innerHTML='<p class="muted">儲存兩家公司後即可比較。</p>';return}
  const rows=[['GPRS 分數',d=>d.result?.total],['等級',d=>d.result?.grade],['營收 CAGR',d=>d.revCagr+'%'],['EPS CAGR',d=>d.epsCagr+'%'],['近 12 月 YoY',d=>d.ttmYoY+'%'],['ROE',d=>d.roe+'%'],['ROIC',d=>d.roic+'%'],['毛利率',d=>d.gm+'%'],['營益率',d=>d.om+'%'],['中性 EPS',d=>d.epsBase],['中性 PE',d=>d.peBase],['中性合理價',d=>money(d.result?.fairBase||0)]];
  $('compareTable').innerHTML=`<div class="table-wrap"><table><thead><tr><th>指標</th>${a.map(d=>`<th>${d.ticker}<br>${d.company||''}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td>${a.map(d=>`<td>${r[1](d)??'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function loadSample(){setData({ticker:'3563',company:'牧德',industry:'PCB／半導體檢測設備',business:'AOI 與外觀檢測設備，未來成長重點為半導體封裝與晶圓檢測。',customers:'PCB 客戶、封裝測試與先進封裝客戶；競爭來自國內外 AOI 設備商。',revCagr:'15',epsCagr:'20',ttmYoY:'18',roe:'24',roic:'20',gm:'61',om:'31',debtRatio:'18',ocf:'8',fcf:'8',contract:'8',working:'7',industryGrowth:'9',moat:'8',stickiness:'8',management:'8',guidance:'8',valuationScore:'5',conference:'訂單能見度、半導體設備驗證、產能擴充與交期。',material:'新竹、昆山及泰國擴產；策略投資與半導體客戶合作。',y1Eps:'34',y2Eps:'42',y3Eps:'50',y1Driver:'PCB 高階需求與半導體初期出貨',y2Driver:'半導體量產與產能開出',y3Driver:'客戶與產品線擴大',epsBear:'34',epsBase:'42',epsBull:'50',peBear:'22',peBase:'28',peBull:'35',marketPricing:'市場仍部分以 PCB 設備公司評價，同時開始反映半導體設備轉型。',growthDrivers:'半導體 AVI、先進封裝、客戶驗證、擴產與產品組合改善。',verification:'月營收、合約負債、毛利率、半導體營收占比、交機與法說承諾。',risks:'驗證延遲、交機不如預期、擴產利用率不足、估值過高。',conclusion:'基本面優秀；關鍵是半導體設備是否能形成連續量產與估值重評。'});}
function exportData(){const blob=new Blob([JSON.stringify(loadAll(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bryant-gprs-backup.json';a.click();URL.revokeObjectURL(a.href)}
function clearAll(){if(confirm('確定清除全部研究資料？')){localStorage.removeItem('bryant_gprs_v3');renderAll()}}
function switchTab(id){document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));$(id).classList.remove('hidden');document.querySelector(`nav button[data-tab="${id}"]`).classList.add('active')}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{storeAll(JSON.parse(r.result));alert('匯入完成')}catch{alert('備份格式錯誤')}};r.readAsText(f)};
let deferredPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
$('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')};
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
renderAll();calculate();


async function loadHistoryCoverage(){
  try{
    const r=await fetch('./data/history/index.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error();
    const x=await r.json();
    if($('histMonths'))$('histMonths').textContent=x.monthly_count??0;
    if($('histQuarters'))$('histQuarters').textContent=x.quarterly_count??0;
    if($('hist24'))$('hist24').textContent=(x.monthly_count>=24?'完整':'累積中');
    if($('hist12q'))$('hist12q').textContent=(x.quarterly_count>=12?'完整':'累積中');
  }catch(e){
    if($('histMonths'))$('histMonths').textContent='尚未建立';
    if($('histQuarters'))$('histQuarters').textContent='尚未建立';
  }
}

loadHistoryCoverage();
