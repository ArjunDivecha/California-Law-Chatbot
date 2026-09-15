/**
 * final-upstash-dump.mjs — full read-only export of every key in the chatbot's Upstash Redis
 * (cal-law-chat-redis) taken immediately before the database is deleted, plus a scan for any
 * key written after the 2026-09-13 23:48Z Turso cutover (which would mean the fallback path
 * was still being hit).
 *
 * Inputs : env UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * Outputs: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/upstash-cleanup-2026-09-13/final-upstash-dump-<UTC>.json
 */
import fs from 'node:fs';
const url=process.env.UPSTASH_REDIS_REST_URL, token=process.env.UPSTASH_REDIS_REST_TOKEN;
const H={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const cmd=async a=>{const r=await fetch(url,{method:'POST',headers:H,body:JSON.stringify(a)});return (await r.json()).result;};
const pipe=async cs=>{const r=await fetch(url+'/pipeline',{method:'POST',headers:H,body:JSON.stringify(cs)});return (await r.json()).map(x=>x.result);};
let cursor='0',keys=[];do{const [c,ks]=await cmd(['SCAN',cursor,'COUNT','5000']);cursor=String(c);keys.push(...ks);}while(cursor!=='0');
keys.sort();
const types=await pipe(keys.map(k=>['TYPE',k])); const ttls=await pipe(keys.map(k=>['TTL',k]));
const vals=await pipe(keys.map((k,i)=>types[i]==='list'?['LRANGE',k,'0','-1']:types[i]==='hash'?['HGETALL',k]:types[i]==='zset'?['ZRANGE',k,'0','-1','WITHSCORES']:types[i]==='set'?['SMEMBERS',k]:['GET',k]));
const CUTOVER='2026-09-13T23:48:00Z';
const late=[];
keys.forEach((k,i)=>{ if(types[i]==='hash'){const f=vals[i]; for(let j=0;j<f.length;j+=2) if(f[j]==='last_active_at'&&f[j+1]>CUTOVER) late.push({key:k,last_active_at:f[j+1]});} });
const dump={exported_at:new Date().toISOString(),db:'cal-law-chat-redis (internal-dassie-98489)',dbsize:await cmd(['DBSIZE']),count:keys.length,keys_written_after_cutover:late,keys:Object.fromEntries(keys.map((k,i)=>[k,{type:types[i],ttl:ttls[i],value:vals[i]}]))};
const out=`reports/upstash-cleanup-2026-09-13/final-upstash-dump-${dump.exported_at.replace(/[:.]/g,'')}.json`;
fs.writeFileSync(out,JSON.stringify(dump));
console.log(JSON.stringify({dbsize:dump.dbsize,keys:keys.length,by_type:types.reduce((m,t)=>(m[t]=(m[t]||0)+1,m),{}),written_after_cutover:late.length,late_sample:late.slice(0,5),out}));
