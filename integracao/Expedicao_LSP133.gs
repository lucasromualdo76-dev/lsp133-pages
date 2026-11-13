/** Expedição fiel à aba Expedição Hoje. Substitui o módulo anterior inteiro. */
const EXPEDICAO_LSP133=Object.freeze({
 spreadsheetId:'1qqVpEFAH2mFkmDNKVOV1POGr1UamHAgQew7NojlyCOc',
 todayTab:'Expedição Hoje',historyTab:'Histórico Diário Expedição',tz:'America/Sao_Paulo',maxDetailRows:500
});
const EXPEDICAO_HEADERS=['Data do turno','Assigned','Complete','Total','Pacotes expedidos','Início da janela','Fim da consulta','Última captura','Resumo operacional JSON'];
function expeditionBook_(){
 const props=PropertiesService.getScriptProperties();
 const configured=String(props.getProperty('SOURCE_SPREADSHEET_ID')||'').trim();
 if(configured&&configured!==EXPEDICAO_LSP133.spreadsheetId)throw new Error('SOURCE_SPREADSHEET_ID aponta para outra planilha. Use a fonte central Lucas.');
 return SpreadsheetApp.openById(EXPEDICAO_LSP133.spreadsheetId);
}
function expeditionISO_(raw){
 if(raw instanceof Date&&!isNaN(raw))return Utilities.formatDate(raw,EXPEDICAO_LSP133.tz,'yyyy-MM-dd');
 const s=String(raw||'').trim(),m=/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s|$)/.exec(s);
 const iso=m?m[3]+'-'+m[2]+'-'+m[1]:/^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
 if(!iso)return '';
 const [y,mo,d]=iso.split('-').map(Number),dt=new Date(Date.UTC(y,mo-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?iso:'';
}
function expeditionBR_(iso){return iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4);}
function expeditionCount_(value){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('Contagem inválida em Expedição Hoje. Aguarde o cálculo da planilha.');
 return value;
}
function expeditionReadCurrent_(book,now){
 const sh=book.getSheetByName(EXPEDICAO_LSP133.todayTab);
 if(!sh)throw new Error('Aba Expedição Hoje não encontrada na fonte central.');
 const day=Utilities.formatDate(now,EXPEDICAO_LSP133.tz,'yyyy-MM-dd');
 const displays=sh.getRange('A3:J5').getDisplayValues();
 const numeric=sh.getRange('D3:H3').getValues()[0];
 if(expeditionISO_(displays[0][1])!==day)throw new Error('A data da aba Expedição Hoje não corresponde ao dia atual.');
 if(displays[2][1]!=='AT'||displays[2][2]!=='STATUS ATUAL'||displays[2][5]!=='DATA OPERACIONAL'||displays[2][9]!=='PACOTES EXPEDIDOS')throw new Error('Cabeçalhos da Expedição Hoje foram alterados.');
 const total=expeditionCount_(numeric[0]),assigned=expeditionCount_(numeric[2]),complete=expeditionCount_(numeric[4]);
 if(assigned+complete!==total)throw new Error('Assigned + Complete diverge do total da planilha.');
 const n=Math.max(0,sh.getLastRow()-5),lines=n?sh.getRange(6,1,n,10).getDisplayValues():[],raw=n?sh.getRange(6,6,n,5).getValues():[];
 const ids=new Set(),details=[],origins=[];
 for(const r of lines){
  const at=String(r[1]||'').trim();if(!at)continue;
  if(!/^AT\d/.test(at)||!['Assigned','Complete'].includes(r[2])||ids.has(at))throw new Error('AT repetida, status ou identificador inválido na Expedição Hoje.');
  const op=expeditionISO_(r[0]);if(!op)throw new Error('Data operacional inválida na Expedição Hoje.');
  const m=/(\d{2}:\d{2})(?::\d{2})?$/.exec(String(r[3]||'').trim());
  if(!m)throw new Error('Horário de atribuição inválido na Expedição Hoje.');
  ids.add(at);details.push({date:day,operationalDate:op,at,status:r[2],hour:m[1],assignedAt:r[3]});
 }
 for(let i=0;i<lines.length;i++){
  const label=String(lines[i][5]||'').trim();if(!label||label.toLowerCase()==='total')continue;
  const date=expeditionISO_(label);if(!date)throw new Error('Data inválida no resumo F:J da Expedição Hoje.');
  const a=expeditionCount_(raw[i][1]),c=expeditionCount_(raw[i][2]),t=expeditionCount_(raw[i][3]),pk=expeditionCount_(raw[i][4]);
  if(a+c!==t)throw new Error('Resumo operacional inconsistente.');
  origins.push({date:day,operationalDate:date,assigned:a,complete:c,total:t,packages:pk});
 }
 const sum=k=>origins.reduce((v,r)=>v+r[k],0);
 if(ids.size!==total||details.filter(r=>r.status==='Assigned').length!==assigned||sum('total')!==total||sum('assigned')!==assigned||sum('complete')!==complete)throw new Error('Planilha recalculando: cartões, ATs e resumo divergem. Repita a consulta.');
 const grouped=new Map();details.forEach(r=>{const k=r.operationalDate,x=grouped.get(k)||{assigned:0,complete:0};x[r.status==='Assigned'?'assigned':'complete']++;grouped.set(k,x);});
 if(grouped.size!==origins.length||origins.some(r=>!grouped.has(r.operationalDate)||grouped.get(r.operationalDate).assigned!==r.assigned||grouped.get(r.operationalDate).complete!==r.complete))throw new Error('Datas operacionais do resumo e das ATs não conferem.');
 const yesterday=new Date(day+'T12:00:00-03:00');yesterday.setUTCDate(yesterday.getUTCDate()-1);
 const start=Utilities.formatDate(yesterday,EXPEDICAO_LSP133.tz,'yyyy-MM-dd')+'T21:00:00-03:00';
 return {date:day,assigned,complete,total,packages:sum('packages'),windowStart:start,windowEnd:now.toISOString(),capturedAt:now.toISOString(),origins,details};
}
function expeditionHistorySheet_(book,create){
 let sh=book.getSheetByName(EXPEDICAO_LSP133.historyTab);
 if(!sh&&create){sh=book.insertSheet(EXPEDICAO_LSP133.historyTab);sh.getRange(1,1,1,9).setValues([EXPEDICAO_HEADERS]);sh.setFrozenRows(1);}
 if(sh&&sh.getRange(1,1,1,9).getDisplayValues()[0].join('|')!==EXPEDICAO_HEADERS.join('|'))throw new Error('Cabeçalho do Histórico Diário Expedição não confere.');
 return sh;
}
function expeditionReadHistory_(book){
 const sh=expeditionHistorySheet_(book,false);if(!sh||sh.getLastRow()<2)return [];
 const rows=sh.getRange(2,1,sh.getLastRow()-1,9).getValues(),seen=new Set();
 return rows.filter(r=>r[0]!=='').map(r=>{
  const date=expeditionISO_(r[0]);if(!date||seen.has(date))throw new Error('Data inválida ou repetida no histórico diário.');seen.add(date);
  const assigned=expeditionCount_(r[1]),complete=expeditionCount_(r[2]),total=expeditionCount_(r[3]),packages=expeditionCount_(r[4]);
  if(assigned+complete!==total)throw new Error('Histórico diário inconsistente.');
  const origins=JSON.parse(String(r[8]||'[]'));
  return {date,assigned,complete,total,packages,windowStart:String(r[5]),windowEnd:String(r[6]),capturedAt:String(r[7]),origins};
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function expeditionDailyState_(book,now){
 const current=expeditionReadCurrent_(book,now);
 const {details,...summary}=current;
 const daily=expeditionReadHistory_(book).filter(r=>r.date<current.date).concat([summary]);
 return {current,daily};
}
/** Exportação agregada para GitHub: nunca publica códigos de AT ou BR. */
function expeditionPublicSummary_(book,now){
 const data=expeditionDailyState_(book,now),{details,...current}=data.current;
 return {current,daily:data.daily,source:'Expedição Hoje',criterion:'Desde ontem às 21h até a consulta, America/Sao_Paulo; status Assigned ou Complete; AT única.'};
}
function getExpeditionData(filters){
 assertAuthorized_();
 const f=normalizeFilters_(filters||{});if(f.from&&f.to&&f.from>f.to)throw new Error('Período inválido.');
 const now=new Date(),data=expeditionDailyState_(expeditionBook_(),now),current=data.current;
 const daily=data.daily.filter(r=>(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to));
 const search=String(f.search||'').trim().toLowerCase();
 const details=current.details.filter(r=>!search||r.at.toLowerCase().includes(search));
 const totals=daily.reduce((a,r)=>({assigned:a.assigned+r.assigned,complete:a.complete+r.complete,total:a.total+r.total,packages:a.packages+r.packages}),{assigned:0,complete:0,total:0,packages:0});
 const hours=new Map();current.details.forEach(r=>{const hour=r.hour.slice(0,2),x=hours.get(hour)||{date:current.date,hour,assigned:0,complete:0,total:0};x[r.status==='Assigned'?'assigned':'complete']++;x.total++;hours.set(hour,x);});
 return {updatedAt:Utilities.formatDate(now,EXPEDICAO_LSP133.tz,'dd/MM/yyyy HH:mm:ss'),today:current.date,source:'Fonte central · Expedição Hoje',currentAvailable:true,
 kpis:{today:{assigned:current.assigned,complete:current.complete,total:current.total,packages:current.packages},period:totals},daily,
 origins:current.origins,hours:[...hours.values()],details:details.slice(0,EXPEDICAO_LSP133.maxDetailRows),detailCount:details.length,detailLimit:EXPEDICAO_LSP133.maxDetailRows,
 historyDates:data.daily.filter(r=>r.date!==current.date).length,windowStart:current.windowStart,windowEnd:current.windowEnd,
 note:'Mesmos valores de D3, F3, H3 e F:J da Expedição Hoje. Desde ontem às 21h. A busca filtra somente o detalhamento de ATs; cartões e resumo permanecem iguais à planilha. Dias sem captura não são preenchidos com zero.'};
}
/** Salva a fotografia agregada do dia. Substitui a linha do mesmo dia; não soma ATs repetidamente. */
function expeditionCapture_(){
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const book=expeditionBook_(),now=new Date(),data=expeditionReadCurrent_(book,now),sh=expeditionHistorySheet_(book,true);
  const prior=expeditionReadHistory_(book),index=prior.findIndex(r=>r.date===data.date);
  if(index<0&&prior.some(r=>r.date>data.date))throw new Error('Há data futura no histórico diário.');
  const row=index<0?sh.getLastRow()+1:2+sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().findIndex(r=>expeditionISO_(r[0])===data.date);
  if(row>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),1);
  sh.getRange(row,1,1,9).setValues([[expeditionBR_(data.date),data.assigned,data.complete,data.total,data.packages,data.windowStart,data.windowEnd,data.capturedAt,JSON.stringify(data.origins)]]);
  return {date:data.date,total:data.total,assigned:data.assigned,complete:data.complete,packages:data.packages};
 }finally{lock.releaseLock();}
}
function expeditionHourlyTrigger(){
 const owner=PropertiesService.getScriptProperties().getProperty('EXPEDITION_TRIGGER_OWNER');
 if(!owner||String(Session.getEffectiveUser().getEmail()||'').toLowerCase()!==owner)throw new Error('Responsável pela captura não autorizado.');
 return expeditionCapture_();
}
function instalarAutomacaoExpedicaoLSP133(){
 assertAuthorized_();
 const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();if(!email)throw new Error('Entre com a conta responsável.');
 const props=PropertiesService.getScriptProperties(),owner=props.getProperty('EXPEDITION_TRIGGER_OWNER');
 if(owner&&owner!==email)throw new Error('Já existe outro responsável pela captura.');
 const result=expeditionCapture_();props.setProperty('EXPEDITION_TRIGGER_OWNER',email);
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='expeditionHourlyTrigger').forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('expeditionHourlyTrigger').timeBased().everyMinutes(15).create();
 ScriptApp.newTrigger('expeditionHourlyTrigger').timeBased().atHour(23).nearMinute(50).inTimezone(EXPEDICAO_LSP133.tz).everyDays(1).create();
 console.log(JSON.stringify(result));return result;
}
