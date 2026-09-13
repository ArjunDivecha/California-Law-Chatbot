/**
 * backup-pks-keys.mjs — read-only export of the stale Personal Knowledge System keys that
 * live inside the California Law Chatbot's Upstash Redis (cal-law-chat-redis /
 * internal-dassie-98489), taken before those keys are purged.
 *
 * Inputs : env UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (from the repo .env)
 * Outputs: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/upstash-cleanup-2026-09-13/cal-law-chat-redis-pks-keys-backup.json
 *          /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/upstash-cleanup-2026-09-13/cal-law-chat-redis-pks-keys-backup-keylist.txt
 */
import fs from 'node:fs';
const url=process.env.UPSTASH_REDIS_REST_URL, token=process.env.UPSTASH_REDIS_REST_TOKEN, OUT=process.env.OUT;
const H={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const cmd=async a=>{const r=await fetch(url,{method:'POST',headers:H,body:JSON.stringify(a)});return (await r.json()).result;};
const pipe=async cs=>{const r=await fetch(url+'/pipeline',{method:'POST',headers:H,body:JSON.stringify(cs)});return (await r.json()).map(x=>x.result);};
let cursor='0',keys=[];do{const [c,ks]=await cmd(['SCAN',cursor,'COUNT','5000']);cursor=String(c);keys.push(...ks);}while(cursor!=='0');
export const PURGE=/^(knowledge|by_domain|pks|ingested|classification|index|by_state|validation|ingestion|migration):/;
const KEEP=/^(session|audit|audit_record_envelope|chat|user|manifest|box):/;
const target=keys.filter(k=>PURGE.test(k)); const other=keys.filter(k=>!PURGE.test(k)&&!KEEP.test(k));
console.log('total',keys.length,'purge',target.length,'keep',keys.filter(k=>KEEP.test(k)).length,'UNCLASSIFIED',other);
if(other.length) throw new Error('unclassified keys present — refusing');
const dump={};
for(let i=0;i<target.length;i+=200){const b=target.slice(i,i+200);const types=await pipe(b.map(k=>['TYPE',k]));
 const vals=await pipe(b.map((k,j)=>types[j]==='set'?['SMEMBERS',k]:types[j]==='hash'?['HGETALL',k]:types[j]==='list'?['LRANGE',k,'0','-1']:types[j]==='zset'?['ZRANGE',k,'0','-1','WITHSCORES']:['GET',k]));
 b.forEach((k,j)=>dump[k]={type:types[j],value:vals[j]});}
fs.writeFileSync(OUT,JSON.stringify({exported_at:new Date().toISOString(),db:'cal-law-chat-redis (internal-dassie-98489)',count:target.length,keys:dump}));
fs.writeFileSync(OUT.replace('.json','-keylist.txt'),target.join('\n'));
console.log('backup bytes',fs.statSync(OUT).size,'keys',Object.keys(dump).length);
