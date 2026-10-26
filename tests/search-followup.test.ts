import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Deepseek} from '../src/deepseek';
function completion(delta:any,finish='stop'){return new Response(`data: ${JSON.stringify({choices:[{delta}]})}\n\ndata: ${JSON.stringify({choices:[{delta:{},finish_reason:finish}]})}\n\ndata: [DONE]\n\n`);}
function call(name:string,args:any){return completion({tool_calls:[{index:0,id:'test-tool',type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');}
test('a failed search is retried once, and a follow-up must try fresh search again',async()=>{
 let fail=true,searchCalls=0;const modelRequests:any[]=[];
 const client=new Deepseek((async(url,options)=>{
  const payload=JSON.parse(String(options?.body));
  if(String(url).endsWith('/search')){searchCalls++;return fail?new Response('',{status:503}):Response.json({results:[{title:'Fresh source',url:'https://example.com/new',summary:'fresh evidence'}]});}
  modelRequests.push(payload);
  if(payload.tool_choice?.function?.name==='web_search')return call('web_search',{query:'current update'});
  if(payload.messages.at(-1)?.role==='tool')return completion({content:fail?'本次搜索失败。':'本次已重新检索并取得资料。'});
  return completion({content:'无法联网。'}); // Old auto-choice path would keep refusing here.
 }) as typeof fetch);
 const warnings:string[]=[];const first=await client.turn([{role:'user',content:'search'}],'test',true,true,new AbortController().signal,p=>{if(p.kind==='warning')warnings.push(p.text);});
 assert.equal(searchCalls,2);assert.ok(warnings.some(x=>x.includes('HTTP 503')));
 fail=false;const second=await client.turn([{role:'user',content:'search'},{role:'assistant',content:first.content},{role:'user',content:'try again'}],'test',true,true,new AbortController().signal,()=>{});
 assert.equal(searchCalls,3);assert.equal(second.sources.length,1);assert.match(second.content,/重新检索/);
 const planning=modelRequests.filter(r=>r.tool_choice?.function?.name==='web_search');assert.equal(planning.length,2);assert.ok(planning.every(r=>r.thinking.type==='disabled'));
 assert.ok(modelRequests.filter(r=>r.tool_choice==='auto').every(r=>r.thinking.type==='enabled'));
});
test('non-retryable web errors retain status code and are not blindly retried',async()=>{
 let searches=0;const warnings:string[]=[];const client=new Deepseek((async(url,options)=>{
  const body=JSON.parse(String(options?.body));if(String(url).endsWith('/search')){searches++;return new Response('',{status:402});}
  return body.tool_choice?.function?.name==='web_search'?call('web_search',{query:'test'}):completion({content:'本次余额不足。'});
 }) as typeof fetch);
 await client.turn([],'test',false,true,new AbortController().signal,p=>{if(p.kind==='warning')warnings.push(p.text);});assert.equal(searches,1);assert.ok(warnings.some(x=>x.includes('HTTP 402')&&x.includes('余额不足')));
});
test('previous verified sources remain readable across user turns',async()=>{
 let step=0,fetches=0;const warnings:string[]=[];const client=new Deepseek((async(url)=>{
  if(String(url).endsWith('/search'))return Response.json({results:[]});
  if(String(url).endsWith('/fetch')){fetches++;return Response.json({title:'Earlier source',content:'actual page text'});}
  step++;if(step===1)return call('web_search',{query:'follow up'});if(step===2)return call('web_fetch',{url:'https://example.com/previous'});return completion({content:'已读取之前的网页。'});
 }) as typeof fetch);
 const result=await client.turn([],'test',false,true,new AbortController().signal,p=>{if(p.kind==='warning')warnings.push(p.text);},[{title:'Earlier',url:'https://example.com/previous'}]);assert.equal(fetches,1);assert.deepEqual(warnings,[]);assert.equal(result.sources[0].url,'https://example.com/previous');
});
test('a model refusal without any tool call is not reported as successful web search',async()=>{
 const client=new Deepseek((async()=>completion({content:'我无法联网'})) as typeof fetch);
 await assert.rejects(()=>client.turn([],'test',true,true,new AbortController().signal,()=>{}),/没有执行搜索/);
});
