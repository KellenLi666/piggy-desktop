import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),env={...process.env,PIGGY_TEST_MODE:'1',PIGGY_TEST_DATA:path.join(root,'.test-data',`search-followup-${Date.now()}`)};delete env.ELECTRON_RUN_AS_NODE;
const instance=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root],env,timeout:45000});
try{
 const pet=await instance.firstWindow();await pet.waitForSelector('.pet-controls');await pet.evaluate(()=>window.piggy.saveKey('search-regression-not-a-real-key'));
 const opened=instance.waitForEvent('window');await pet.evaluate(()=>window.piggy.showPanel('chat'));const chat=await opened;await chat.waitForSelector('.composer');
 await instance.evaluate(()=>{
  globalThis.__searchFail=true;globalThis.__searchCalls=0;globalThis.fetch=async(url,options)=>{
   const body=JSON.parse(options.body);
   if(String(url).endsWith('/search')){globalThis.__searchCalls++;return globalThis.__searchFail?new Response('',{status:503}):Response.json({results:[{title:'Verified test source',url:'https://example.com/source',summary:'test evidence'}]});}
   const forced=body.tool_choice?.function?.name==='web_search';
   const delta=forced?{tool_calls:[{index:0,id:'web-test',type:'function',function:{name:'web_search',arguments:'{"query":"test update"}'}}]}:{content:globalThis.__searchFail?'本轮搜索暂时失败，请稍后重试。':'这次已实际重新搜索并取得资料。'};
   return new Response(`data: ${JSON.stringify({choices:[{delta}]})}\n\ndata: ${JSON.stringify({choices:[{delta:{},finish_reason:forced?'tool_calls':'stop'}]})}\n\ndata: [DONE]\n\n`);
  };
 });
 await chat.getByRole('button',{name:'◎ 联网搜索',exact:true}).click();
 await chat.getByLabel('消息输入框').fill('搜索一次');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await chat.getByText(/联网搜索接口返回 HTTP 503/).waitFor();
 assert.equal(await chat.getByRole('button',{name:'◎ 联网搜索',exact:true}).getAttribute('aria-pressed'),'true');
 await instance.evaluate(()=>{globalThis.__searchFail=false;});
 await chat.getByLabel('消息输入框').fill('再尝试搜索');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await chat.getByText('这次已实际重新搜索并取得资料。',{exact:true}).waitFor();
 const state=await chat.evaluate(()=>window.piggy.state()),last=state.conversation.messages.at(-1);assert.equal(last.status,'complete');assert.equal(last.error,undefined);assert.equal(last.sources.length,1);assert.equal(await instance.evaluate(()=>globalThis.__searchCalls),3);
 const report={ok:true,checks:['first failure has HTTP 503 warning','transient search retried once','search remains enabled','next message performs fresh search','new successful turn has source and no stale error'],liveApiRequests:0,packaged:false};fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/search-followup-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await instance.close();}
