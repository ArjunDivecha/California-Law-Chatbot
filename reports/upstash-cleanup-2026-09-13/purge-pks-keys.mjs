/**
 * purge-pks-keys.mjs — delete the stale Personal Knowledge System keys from the California
 * Law Chatbot's Upstash Redis (cal-law-chat-redis / internal-dassie-98489). Only keys listed
 * in the backup keylist are deleted; chatbot-owned session/audit/chat/user/manifest/box keys
 * are never touched. Run backup-pks-keys.mjs first.
 *
 * Inputs : env UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *          /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/upstash-cleanup-2026-09-13/cal-law-chat-redis-pks-keys-backup-keylist.txt
 * Outputs: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/reports/upstash-cleanup-2026-09-13/purge-log.json
 */
import fs from 'node:fs';
const url=process.env.UPSTASH_REDIS_REST_URL, token=process.env.UPSTASH_REDIS_REST_TOKEN, DIR=process.env.DIR;
const H={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const cmd=async a=>{const r=await fetch(url,{method:'POST',headers:H,body:JSON.stringify(a)});return (await r.json()).result;};
const pipe=async cs=>{const r=await fetch(url+'/pipeline',{method:'POST',headers:H,body:JSON.stringify(cs)});return (await r.json()).map(x=>x.result);};
const PURGE=/^(knowledge|by_domain|pks|ingested|classification|index|by_state|validation|ingestion|migration):/;
const keys=fs.readFileSync(`${DIR}/cal-law-chat-redis-pks-keys-backup-keylist.txt`,'utf8').split('\n').filter(Boolean);
const bad=keys.filter(k=>!PURGE.test(k)); if(bad.length) throw new Error('keylist contains non-PKS keys: '+bad.slice(0,5));
const before=await cmd(['DBSIZE']); let deleted=0;
for(let i=0;i<keys.length;i+=100){const b=keys.slice(i,i+100); const [n]=await pipe([['UNLINK',...b]]); deleted+=n||0;}
const after=await cmd(['DBSIZE']);
let cursor='0',left=[];do{const [c,ks]=await cmd(['SCAN',cursor,'COUNT','5000']);cursor=String(c);left.push(...ks);}while(cursor!=='0');
const stillPks=left.filter(k=>PURGE.test(k));
const log={ran_at:new Date().toISOString(),dbsize_before:before,dbsize_after:after,requested:keys.length,deleted,remaining_pks_keys:stillPks.length,remaining_by_prefix:Object.entries(left.reduce((m,k)=>{const p=k.split(':')[0];m[p]=(m[p]||0)+1;return m;},{}))};
fs.writeFileSync(`${DIR}/purge-log.json`,JSON.stringify(log,null,1)); console.log(JSON.stringify(log));
