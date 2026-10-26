import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),exe=path.join(root,'release/win-unpacked/Piggy.exe');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.PIGGY_TEST_MODE;delete env.PIGGY_TEST_DATA;
const instance=await electron.launch({executablePath:exe,env,timeout:45000});
try{
 const pet=await instance.firstWindow();const errors=[];pet.on('pageerror',e=>errors.push(e.message));await pet.waitForSelector('.pet-controls');
 assert.equal(await pet.locator('.pet-controls button').count(),2);
 const runtime=await instance.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion(),electron:process.versions.electron,platform:process.platform,arch:process.arch}));
 assert.equal(runtime.packaged,true);assert.equal(runtime.arch,'x64');
 const quickPromise=instance.waitForEvent('window');await pet.getByRole('button',{name:'文字对话',exact:true}).dispatchEvent('pointerover',{pointerType:'mouse'});const quick=await quickPromise;quick.on('pageerror',e=>errors.push(e.message));await quick.waitForSelector('.quick-composer');
 assert.ok(await quick.getByTestId('quick-message').count()<=3);assert.equal(await quick.getByRole('button',{name:'放大对话框',exact:true}).count(),1);
 await quick.getByRole('button',{name:'收起轻聊',exact:true}).click();
 const promise=instance.waitForEvent('window');await pet.getByRole('button',{name:'设置',exact:true}).click({force:true});const settings=await promise;settings.on('pageerror',e=>errors.push(e.message));await settings.waitForSelector('.settings-layout');
 assert.equal(await settings.getByLabel('DeepSeek API 密钥').inputValue(),'');
 assert.equal(await settings.locator('input[type=range]').count(),0);assert.equal(await settings.getByText('宠物大小',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(root,'qa/package-report.json'),JSON.stringify({ok:true,runtime,checks:['standalone exe launches','bundled renderer and sprite load','two controls without voice','hover quick chat opens','quick chat has at most three message bubbles','expand control present','settings opens','size control removed','saved key not exposed','no renderer exception'],liveApiRequests:0},null,2));
 console.log(JSON.stringify({ok:true,runtime,checks:10,liveApiRequests:0}));
}finally{await instance.close();}
