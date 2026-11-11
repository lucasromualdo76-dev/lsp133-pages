// Dados inteiramente sintéticos. Não use planilhas, tokens ou dados corporativos aqui.
import { mkdir, writeFile } from 'node:fs/promises';
const today = new Date();
today.setUTCHours(0,0,0,0);
const days = Array.from({length:14},(_,i)=>{
  const dt = new Date(today.getTime()-(13-i)*86400000);
  const date = dt.toISOString().slice(0,10);
  const seed = (i*17 + Math.floor(dt.getTime()/86400000))%29;
  const assigned = 54+i*4+(seed%14);
  const complete = 6+(seed%13);
  const routesOut = assigned+complete;
  const routesFloor = 18+(seed*3%34);
  const packagesOut = routesOut*(145+(seed%28));
  const packagesFloor = routesFloor*(102+(seed%45));
  const failures = 11+(seed%19);
  const resolved = Math.max(0,failures-2-(seed%7));
  return {date,assigned,complete,routesOut,routesFloor,packagesOut,packagesFloor,
    failures,uniqueBR:failures,resolved,labelErrors:2+(seed%9),shippingErrors:1+(seed%7)};
});
const payload = {mode:'DEMO',generatedAt:new Date().toISOString(),source:'synthetic-generator',days};
await mkdir('data',{recursive:true});
await writeFile('data/indicadores-demo.json',JSON.stringify(payload,null,2)+'\n');
console.log('Dados sintéticos renovados:',days.length,'datas; atualizado em',payload.generatedAt);
