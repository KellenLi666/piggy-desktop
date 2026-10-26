import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),data=path.join(root,'.test-data/drag-fixed-size');
fs.mkdirSync(data,{recursive:true});
fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({personality:'保持这段自定义文风',thinking:false,allowSearch:true,scale:2,roaming:false,topmost:true}));
const env={...process.env,PIGGY_TEST_MODE:'1',PIGGY_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
const instance=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root],env,timeout:45000});
try{
 const page=await instance.firstWindow();await page.waitForSelector('.pet-sprite');
 const state=await page.evaluate(()=>window.piggy.state());assert.equal('scale' in state.settings,false);assert.equal(state.settings.personality,'保持这段自定义文风');
 const area=await instance.evaluate(({screen})=>screen.getPrimaryDisplay().workArea);
 const dpi=await instance.evaluate(({screen})=>screen.getPrimaryDisplay().scaleFactor);
 const bounds=()=>instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Piggy').getBounds());
 const start=await bounds(),snapshots=[];
 for(let round=0;round<25;round++){
   const origin=await bounds();
   await page.evaluate(async({origin,round})=>{
     window.piggy.beginDrag({x:origin.x+70,y:origin.y+55});
     const targets=[{x:-1000,y:-1000},{x:5000,y:-1000},{x:-1000,y:5000},{x:5000,y:5000},{x:500,y:400}];
     for(let i=0;i<100;i++){window.piggy.drag(targets[(i+round)%targets.length]);if(i%10===0)await window.piggy.state();}
     await window.piggy.state();window.piggy.endDrag();await window.piggy.state();
   },{origin,round});
   snapshots.push(await bounds());
 }
 const widths=[start.width,...snapshots.map(s=>s.width)],heights=[start.height,...snapshots.map(s=>s.height)];
 assert.ok(Math.max(...widths)-Math.min(...widths)<=1,'width drift');assert.ok(Math.max(...heights)-Math.min(...heights)<=1,'height drift');
 assert.ok(Math.abs(start.width-180)<=1&&Math.abs(start.height-210)<=1,'legacy scale must not affect size');
 const edges=[];
 for(const target of [{x:area.x-10000,y:area.y-10000},{x:area.x+area.width+10000,y:area.y+area.height+10000}]){
   const origin=await bounds();await page.evaluate(async({origin,target})=>{window.piggy.beginDrag({x:origin.x+70,y:origin.y+55});window.piggy.drag(target);await window.piggy.state();window.piggy.endDrag();await window.piggy.state();},{origin,target});edges.push(await bounds());
 }
 assert.ok(Math.abs(edges[0].x-area.x)<=1&&Math.abs(edges[0].y-area.y)<=1);
 assert.ok(Math.abs(edges[1].x-(area.x+area.width-180))<=1&&Math.abs(edges[1].y-(area.y+area.height-210))<=1);
 const opened=instance.waitForEvent('window');await page.evaluate(()=>window.piggy.showPanel('settings'));const settings=await opened;await settings.waitForSelector('.settings-layout');
 assert.equal(await settings.locator('input[type=range]').count(),0);assert.equal(await settings.getByText('宠物大小',{exact:true}).count(),0);
 assert.equal(await settings.getByLabel('Piggy 的文风').inputValue(),'保持这段自定义文风');
 assert.ok(!fs.readFileSync('src/main.ts','utf8').includes('pet.setPosition('));
 const report={ok:true,displayScaleFactor:dpi,totalDragMoves:2502,fixedSize:{width:180,height:210},start,after:snapshots.at(-1),widthRange:[Math.min(...widths),Math.max(...widths)],heightRange:[Math.min(...heights),Math.max(...heights)],edges,settingsUiSizeControlRemoved:true,legacyPreferencesPreserved:true,packaged:false};
 fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/drag-fixed-size-regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await instance.close();}
