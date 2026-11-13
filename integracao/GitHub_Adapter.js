/* Transporte do mesmo Index.html do Apps Script para GitHub Pages. Sem credenciais. */
(function(){
 'use strict';
 const APP='https://script.google.com/a/macros/shopeemobile-external.com/s/AKfycbyj5tAJaVY8V2A5qYyE47lNpnta_AwTII8iHdcfMnQmb-AkxJxUVHcDx-xCrK7-k2uCgA/exec';
 const BR=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'});
 function inPeriod(r,f){return (!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to);}
 async function source(){
  const response=await fetch('./data/indicadores.json?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('Não foi possível carregar a publicação de dados.');
  const data=await response.json();if(data.mode!=='REAL_AGGREGATED'||!Array.isArray(data.days))throw new Error('A publicação não contém indicadores reais.');return data;
 }
 function production(data,f,history){
  const view=history?data.appViews?.history:data.appViews?.production;
  let rows=view?view.daily:(history?data.history||[]:data.days.filter(r=>r.routesObserved!==false));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const daily=rows.filter(r=>inPeriod(r,f)).map(r=>{
   const missingOut=Number(r.missingOut??r.pendingPackagesOut??0),missingFloor=Number(r.missingFloor??r.pendingPackagesFloor??0);
   return {...r,missingOut,missingFloor,missingPackages:missingOut+missingFloor,status:r.status||(history?r.snapshotType||'CAPTURA':r.routesFloor?'D'+Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(r.date+'T00:00:00Z'))/86400000):'Piso zerado'),notes:r.notes||(missingOut+missingFloor?`${missingOut+missingFloor} rota(s) sem quantidade de pacotes na origem`:history?'Captura: '+(r.snapshotAt||''):'')};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const kpis={routesOut:0,routesFloor:0,packagesOut:0,packagesFloor:0};daily.forEach(r=>Object.keys(kpis).forEach(k=>kpis[k]+=Number(r[k])||0));
  kpis.spr=daily.some(r=>r.missingOut)||!kpis.routesOut?null:kpis.packagesOut/kpis.routesOut;
  const packagesDaily=view?.packagesDaily?view.packagesDaily.filter(r=>inPeriod(r,f)):daily.map(r=>({date:r.date,packagesOut:r.packagesOut,packagesFloor:r.packagesFloor,packagesHistorical:0}));
  return {updatedAt:BR.format(new Date(data.generatedAt)),daily,kpis,missingPackages:daily.reduce((v,r)=>v+r.missingPackages,0),packagesDaily};
 }
 function expedition(data,f){
  const turn=data.expeditionTurn;if(!turn?.current||!Array.isArray(turn.daily))throw new Error('Aguardando sincronização da aba Expedição Hoje. Execute syncLsp133ToGitHub na Central.');
  const c=turn.current;if(c.assigned+c.complete!==c.total)throw new Error('Os totais de expedição não conferem.');
  return {updatedAt:BR.format(new Date(c.capturedAt)),today:c.date,source:'Fonte central · Expedição Hoje',currentAvailable:true,kpis:{today:c},daily:turn.daily.filter(r=>inPeriod(r,f)),origins:c.origins||[],hours:[],details:[],detailCount:0,detailLimit:500,historyDates:turn.daily.filter(r=>r.date!==c.date).length,note:turn.criterion||'Desde ontem às 21h.'};
 }
 function corporate(area){window.location.assign(APP+(area?'?area='+area:''));}
 async function invoke(method,args){
  if(method==='requestSpxCloudUpdate'){corporate('spx');return {busy:false,canUpdate:true,label:'Abrindo controle autenticado…'};}
  if(method==='recordProductionSnapshot'){corporate('');return {message:'Salve a captura na Central autenticada.'};}
  if(method==='getSpxCloudStatus')return {busy:false,canUpdate:true,label:'A atualização é executada pela Central autenticada do Google.',updatedAt:null,records:0,runUrl:''};
  if(method==='getDashboardData'){corporate(document.getElementById('eti')?.classList.contains('hidden')?'insucessos':'erros');return null;}
  const data=await source(),f=args[0]||{};
  if(method==='getProductionData')return production(data,f,false);
  if(method==='getProductionHistory')return production(data,f,true);
  if(method==='getExpeditionData')return expedition(data,f);
  throw new Error('Ação disponível na Central autenticada.');
 }
 function runner(success,failure){return new Proxy({}, {get:(_,key)=>{
  if(key==='withSuccessHandler')return cb=>runner(cb,failure);
  if(key==='withFailureHandler')return cb=>runner(success,cb);
  return (...args)=>{Promise.resolve().then(()=>invoke(key,args)).then(result=>{if(result!==null&&success)success(result);}).catch(error=>{if(failure)failure(error);});};}});}
 window.google={script:{run:runner()}};
 // Áreas com dados por AT e horários mantêm acesso autenticado; nada é inventado no JSON público.
 window.lspCorporateURL=APP;
 document.addEventListener('DOMContentLoaded',()=>{
  const oldDetails=window.expDetails,oldHours=window.expHours;
  function access(root){root.replaceChildren();const a=document.createElement('a');a.href=APP;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Consultar na Central autenticada';a.style.cssText='display:inline-block;color:#172338;font-weight:700;padding:12px 0';root.append(a);}
  if(oldDetails)window.expDetails=()=>access(document.getElementById('exp-table'));
  if(oldHours)window.expHours=()=>access(document.getElementById('exp-hours'));
 });
})();
