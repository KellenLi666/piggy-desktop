import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
async function until(read,expected){const deadline=Date.now()+7000;let value;do{value=await read();if(value===expected)return;await new Promise(r=>setTimeout(r,60));}while(Date.now()<deadline);assert.equal(value,expected);}
function expect(locator){return {toHaveValue:value=>until(()=>locator.inputValue(),value)};}
expect.poll=read=>({toBe:value=>until(read,value)});
const root=process.cwd(),env={...process.env,PIGGY_TEST_MODE:'1',PIGGY_TEST_DATA:path.join(root,'.test-data',`quick-${Date.now()}`)};delete env.ELECTRON_RUN_AS_NODE;
const instance=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root],env,timeout:45000});
const checks=[],errors=[];
instance.on('window',page=>page.on('pageerror',e=>errors.push(e.message)));
try{
 const pet=await instance.firstWindow();await pet.waitForSelector('.pet-controls');
 await pet.evaluate(()=>{window.__actions=[];window.piggy.onPet(p=>window.__actions.push(p.action));});
 const newQuick=instance.waitForEvent('window');await pet.getByRole('button',{name:'文字对话',exact:true}).dispatchEvent('pointerover',{pointerType:'mouse'});const quick=await newQuick;await quick.waitForSelector('.quick-composer');
 const position=await instance.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Piggy'),q=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Piggy · 轻聊');return {pet:p.getBounds(),quick:q.getBounds()};});
 assert.ok(position.quick.y+position.quick.height<=position.pet.y+8);checks.push('hover opens quick chat above pet');
 assert.ok((await pet.evaluate(()=>window.__actions)).includes('waving'));
 await quick.evaluate(()=>window.piggy.saveKey('quick-test-key-not-a-real-secret'));
 await instance.evaluate(()=>{
  globalThis.__fail=false;globalThis.fetch=async(_url,options)=>{
   if(globalThis.__fail)return new Response('',{status:429});
   const encoder=new TextEncoder();const chunks=['这是 Piggy 的模拟轻聊回答。','轻聊保留三条气泡，完整记录仍然存在。','这句话用于检查流式显示与自动思考动作。'];let timer;
   const stream=new ReadableStream({start(c){let i=0;const next=()=>{if(options.signal.aborted){c.error(new Error('aborted'));return;}if(i<chunks.length){c.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[{delta:{content:chunks[i++]}}]})}\n\n`));timer=setTimeout(next,220);}else{c.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));c.close();}};timer=setTimeout(next,30);},cancel(){clearTimeout(timer);}});
   return new Response(stream,{headers:{'content-type':'text/event-stream'}});
  };
 });
 const latest=()=>pet.evaluate(()=>window.__actions.at(-1));
 await quick.getByLabel('轻聊输入框').fill('你好');await expect.poll(latest).toBe('waving');
 await quick.getByLabel('轻聊输入框').fill('谢谢你');await expect.poll(latest).toBe('jumping');
 await quick.getByLabel('轻聊输入框').fill('我今天很难过');await expect.poll(latest).toBe('failed');checks.push('greeting, thanks and sadness trigger fitting reactions');
 await quick.getByLabel('轻聊输入框').fill('第一条轻聊问题');await expect.poll(latest).toBe('waiting');
 for(let turn=0;turn<3;turn++){
  await quick.getByLabel('轻聊输入框').fill(`轻聊问题${turn+1}`);await quick.getByRole('button',{name:'发送轻聊消息',exact:true}).click();
  await quick.getByRole('button',{name:'停止轻聊生成',exact:true}).waitFor();await expect.poll(latest).toBe('running');
  await quick.evaluate(()=>window.piggy.activity('read-answer'));assert.equal(await latest(),'running');
  await quick.getByRole('button',{name:'发送轻聊消息',exact:true}).waitFor();
 }
 assert.equal(await quick.getByTestId('quick-message').count(),3);const saved=await quick.evaluate(()=>window.piggy.state());assert.equal(saved.conversation.messages.length,6);checks.push('three visible bubbles, full history retained, thinking has priority');
 fs.mkdirSync('qa',{recursive:true});await quick.screenshot({path:'qa/quick-chat.png',omitBackground:true});
 await quick.getByLabel('轻聊输入框').fill('放大时不要丢掉这段草稿');
 const newChat=instance.waitForEvent('window');await quick.getByRole('button',{name:'放大对话框',exact:true}).click();const full=await newChat;await full.waitForSelector('.composer');
 await expect(full.getByLabel('消息输入框')).toHaveValue('放大时不要丢掉这段草稿');assert.equal(await full.getByTestId('message-user').count(),3);checks.push('expand preserves unsent draft and full conversation');
 await full.getByLabel('消息输入框').fill('从大窗口返回的草稿');await full.getByRole('button',{name:'回到轻聊',exact:true}).click();await expect(quick.getByLabel('轻聊输入框')).toHaveValue('从大窗口返回的草稿');checks.push('return to quick mode preserves draft');
 await quick.getByRole('button',{name:'放大对话框',exact:true}).click();await full.locator('input[type=file]').setInputFiles(path.join(root,'assets/icon.png'));await expect.poll(latest).toBe('review');checks.push('adding an image triggers inspection');
 await full.getByRole('button',{name:'回到轻聊',exact:true}).click();await quick.getByLabel('轻聊输入框').fill('这次会失败');await instance.evaluate(()=>{globalThis.__fail=true;});await quick.getByRole('button',{name:'发送轻聊消息',exact:true}).click();await quick.getByText('DeepSeek 请求过于频繁，请稍后重试。',{exact:true}).waitFor();assert.ok((await pet.evaluate(()=>window.__actions)).includes('failed'));checks.push('request failure reacts without losing conversation');
 await quick.getByRole('button',{name:'收起轻聊',exact:true}).click();await instance.evaluate(()=>{globalThis.__fail=false;});
 const origin=await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Piggy').getBounds());
 await pet.evaluate(async p=>{window.piggy.beginDrag({x:p.x+70,y:p.y+55});window.piggy.drag({x:p.x-30,y:p.y+55});await window.piggy.state();window.piggy.drag({x:p.x+100,y:p.y+55});await window.piggy.state();window.piggy.endDrag();await window.piggy.state();},origin);
 const actions=await pet.evaluate(()=>window.__actions);for(const name of ['idle','running-right','running-left','waving','jumping','failed','waiting','running','review'])assert.ok(actions.includes(name),`no automatic trigger for ${name}`);checks.push('all nine original animation states have verified automatic triggers');
 assert.deepEqual(errors,[]);const report={ok:true,checks,rendererErrors:errors,liveApiRequests:0,packaged:false};fs.writeFileSync('qa/quick-chat-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await instance.close();}
