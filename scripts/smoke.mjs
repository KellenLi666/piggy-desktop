import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),data=path.join(root,'.test-data',`smoke-${Date.now()}`),qa=path.join(root,'qa');fs.mkdirSync(qa,{recursive:true});
const env={...process.env,PIGGY_TEST_MODE:'1',PIGGY_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root],env,timeout:45000});
const checks=[],errors=[];
try{
 const pet=await app.firstWindow();pet.on('pageerror',e=>errors.push(e.message));await pet.waitForSelector('.pet-controls');
 assert.equal(await pet.locator('.pet-controls button').count(),2);assert.equal(await pet.getByRole('button',{name:'语音'}).count(),0);checks.push('two controls, no voice');
 await pet.screenshot({path:path.join(qa,'pet.png'),omitBackground:true});
 const openSettings=app.waitForEvent('window');await pet.getByRole('button',{name:'设置',exact:true}).click({force:true});const settings=await openSettings;settings.on('pageerror',e=>errors.push(e.message));await settings.waitForSelector('.settings-layout');
 await settings.screenshot({path:path.join(qa,'settings.png')});
 await settings.getByLabel('DeepSeek API 密钥').fill('piggy-smoke-fake-key-not-real');await settings.getByRole('button',{name:'保存密钥',exact:true}).click();await settings.getByText('密钥已保存',{exact:true}).waitFor();
 const secret=fs.readFileSync(path.join(data,'secret.bin'));assert.ok(!secret.includes(Buffer.from('piggy-smoke-fake-key-not-real')));assert.equal(await settings.getByLabel('DeepSeek API 密钥').inputValue(),'');checks.push('OS encrypted key, not returned to renderer');
 // Replace only this isolated test process's main-process fetch; no live API request or charge.
 await app.evaluate(()=>{
   globalThis.__requests=[];globalThis.__scenario='normal';
   globalThis.fetch=async(url,options)=>{
     const body=JSON.parse(options.body);globalThis.__requests.push({url:String(url),body});
     if(globalThis.__scenario==='401')return new Response('',{status:401});
     if(globalThis.__scenario==='offline')throw new TypeError('network');
     if(!body.stream)return Response.json({choices:[{message:{content:'OK'}}]});
     const text=body.messages.at(-1)?.content;
     const chunks=['你好，我是 **Piggy**。\n\n','这是一段模拟的流式回答。\n\n','- 保留原动画\n- 连接你自己的 DeepSeek\n\n','[查看来源](https://example.com/)'];
     const encoder=new TextEncoder();let timer;
     const stream=new ReadableStream({start(c){let i=0;const run=()=>{if(options.signal.aborted){c.error(new Error('aborted'));return;}if(i<chunks.length){c.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[{delta:{content:chunks[i++]}}]})}\n\n`));timer=setTimeout(run,globalThis.__scenario==='slow'?1000:90);}else{c.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));c.close();}};timer=setTimeout(run,20);},cancel(){clearTimeout(timer);}});
     return new Response(stream,{headers:{'content-type':'text/event-stream'}});
   };
 });
 await settings.getByRole('button',{name:'测试连接',exact:true}).click();await settings.getByRole('alert').filter({hasText:'连接成功'}).waitFor();checks.push('connection test with mock transport');
 const openChat=app.waitForEvent('window');await settings.getByRole('button',{name:'返回聊天',exact:true}).click();const chat=await openChat;chat.on('pageerror',e=>errors.push(e.message));await chat.waitForSelector('.composer');
 await chat.screenshot({path:path.join(qa,'chat-empty.png')});
 await chat.getByLabel('消息输入框').fill('你好，介绍一下自己');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await chat.getByRole('button',{name:'停止生成'}).waitFor();await chat.getByRole('button',{name:'发送消息',exact:true}).waitFor();await chat.getByText('这是一段模拟的流式回答。').waitFor();checks.push('streaming response, Markdown, busy/ready controls');
 await chat.screenshot({path:path.join(qa,'chat-answer.png')});
 await chat.getByRole('button',{name:'复制回答',exact:true}).click();const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.ok(copied.includes('Piggy'));checks.push('copy response');
 await chat.locator('input[type=file]').setInputFiles(path.join(root,'assets/icon.png'));assert.equal(await chat.locator('.attachments img').count(),1);await chat.getByLabel('消息输入框').fill('看一下图片');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await chat.getByRole('button',{name:'停止生成'}).waitFor();await chat.getByRole('button',{name:'发送消息',exact:true}).waitFor();const imageRequest=await app.evaluate(()=>globalThis.__requests.at(-1).body);assert.ok(imageRequest.messages.at(-1).content.some(c=>c.type==='image_url'));assert.ok(imageRequest.messages.some(m=>m.role==='assistant'));checks.push('image upload and continuous context');
 await app.evaluate(()=>{globalThis.__scenario='slow';});await chat.getByLabel('消息输入框').fill('请慢慢回答');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await chat.getByRole('button',{name:'停止生成'}).click();await chat.getByRole('button',{name:'发送消息',exact:true}).waitFor();await chat.getByText('已停止生成。',{exact:true}).waitFor();checks.push('cancellation');
 await app.evaluate(()=>{globalThis.__scenario='401';});await chat.getByLabel('消息输入框').fill('失败重试测试');await chat.getByRole('button',{name:'发送消息',exact:true}).click();await chat.getByText('DeepSeek 密钥无效，请在设置中更换。',{exact:true}).waitFor();await chat.getByRole('button',{name:'恢复输入并重试'}).last().click();assert.equal(await chat.getByLabel('消息输入框').inputValue(),'失败重试测试');checks.push('failure notification and recover draft');
 await chat.getByRole('button',{name:'新建对话',exact:true}).click();await chat.getByRole('heading',{name:'今天想聊些什么？'}).waitFor();await chat.getByRole('button',{name:'历史对话',exact:true}).click();assert.ok(await chat.locator('.history-list>div').count()>=3);checks.push('new conversation and local history');
 const properties=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({title:w.getTitle(),transparent:w.getBackgroundColor(),topmost:w.isAlwaysOnTop(),bounds:w.getBounds()})));assert.ok(properties.some(p=>p.title==='Piggy'&&p.topmost));checks.push('transparent topmost desktop window');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'smoke-report.json'),JSON.stringify({ok:true,checks,rendererErrors:errors,network:'mock transport only',liveDeepseek:'not tested'},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,rendererErrors:errors}));
}finally{await app.close();}
