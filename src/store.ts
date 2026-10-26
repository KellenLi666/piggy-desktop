import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DEFAULT_SETTINGS,type Conversation,type Summary,type Attachment,type Settings} from './shared';
import {safeSettings,imageBytes} from './core';
export function atomic(file:string,value:unknown){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value));fs.renameSync(temp,file);}
function read(file:string):any {try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return undefined;}}
export class Store {
  settings:Settings; activeId='';
  constructor(public root:string){fs.mkdirSync(path.join(root,'chats'),{recursive:true});this.settings=safeSettings(read(path.join(root,'settings.json')));}
  saveSettings(s:Settings){this.settings=s;atomic(path.join(this.root,'settings.json'),s);}
  list():Summary[]{return fs.readdirSync(path.join(this.root,'chats')).filter(n=>/^[\da-f-]+\.json$/.test(n)).map(n=>read(path.join(this.root,'chats',n))).filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).map(c=>({id:c.id,title:c.title,updated:c.updated})).sort((a,b)=>b.updated-a.updated);}
  file(id:string){if(!/^[\da-f-]{36}$/.test(id))throw new Error('会话不存在');return path.join(this.root,'chats',id+'.json');}
  create():Conversation {const c={id:randomUUID(),title:'新对话',updated:Date.now(),messages:[]};this.save(c);this.activeId=c.id;return c;}
  load(id:string):Conversation {
    const c=read(this.file(id)) as Conversation|undefined;
    if(!c||!Array.isArray(c.messages))throw new Error('无法读取这段对话');
    let recovered=false;
    for(const m of c.messages){
      if(m.status==='generating'){m.status='stopped';m.error='上次退出时回答尚未完成，可重新发送。';recovered=true;}
      if(m.images)m.images=m.images.map(im=>this.hydrate(id,im));
    }
    if(recovered)this.save(c);
    this.activeId=c.id;return c;
  }
  hydrate(chat:string,im:Attachment):Attachment {
    try{return {...im,dataUrl:`data:${im.mime};base64,${fs.readFileSync(this.imagePath(chat,im)).toString('base64')}`};}catch{return {...im,dataUrl:''};}
  }
  imagePath(chat:string,im:Attachment){this.file(chat);if(!/^[\da-f-]{36}$/.test(im.id))throw new Error('图片标识无效');const ext=im.mime==='image/jpeg'?'jpg':im.mime==='image/webp'?'webp':'png';return path.join(this.root,'attachments',chat,`${im.id}.${ext}`);}
  save(c:Conversation){
    const persisted:Conversation={...c,messages:c.messages.map(m=>({...m,images:m.images?.map(im=>{
      const file=this.imagePath(c.id,im);
      if(im.dataUrl&&!fs.existsSync(file)){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,imageBytes(im));}
      return {...im,dataUrl:''};
    })}))};
    atomic(this.file(c.id),persisted);
  }
  delete(id:string){fs.rmSync(this.file(id),{force:true});fs.rmSync(path.join(this.root,'attachments',id),{recursive:true,force:true});}
  clear(){for(const c of this.list())this.delete(c.id);}
}
