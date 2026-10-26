import { z } from 'zod';
import { DEFAULT_SETTINGS, type Attachment, type Conversation, type Settings } from './shared';
export const settingsSchema = z.object({personality:z.string().max(12000), thinking:z.boolean(), allowSearch:z.boolean(), roaming:z.boolean(), topmost:z.boolean()}).strict();
export const attachmentSchema = z.object({id:z.string().uuid(),name:z.string().min(1).max(255),mime:z.enum(['image/png','image/jpeg','image/webp']),dataUrl:z.string().max(14_000_000)}).strict();
export const sendSchema = z.object({text:z.string().max(60000),images:z.array(attachmentSchema).max(4),search:z.boolean()}).strict().refine(x=>x.text.trim().length>0||x.images.length>0,'请输入内容或添加图片');
export function parseSettings(input:unknown):Settings {return settingsSchema.parse(input);}
export function safeSettings(input:unknown):Settings {
  // Older installations saved a scale option. Ignore only that retired field
  // while keeping the user's personality and other valid preferences.
  const candidate=input!==null&&typeof input==='object'&&!Array.isArray(input)
    ?Object.fromEntries(Object.entries(input).filter(([name])=>name!=='scale')):input;
  const value=settingsSchema.safeParse(candidate);return value.success?value.data:{...DEFAULT_SETTINGS};
}
export function imageBytes(image:Attachment):Buffer {
  const prefix=`data:${image.mime};base64,`;
  if(!image.dataUrl.startsWith(prefix)) throw new Error('图片格式与内容不一致');
  const encoded=image.dataUrl.slice(prefix.length);
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4!==0) throw new Error('图片编码无效');
  const buffer=Buffer.from(encoded,'base64');
  if(buffer.length===0||buffer.length>10*1024*1024) throw new Error('每张图片必须在 10 MB 以内');
  const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
  const webp=buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  if(!(image.mime==='image/png'&&png||image.mime==='image/jpeg'&&jpg||image.mime==='image/webp'&&webp)) throw new Error('请选择有效的 PNG、JPEG 或 WebP 图片');
  return buffer;
}
export function httpUrl(value:unknown):string {
  if(typeof value!=='string'||value.length>8192) throw new Error('链接无效');
  let u:URL;try{u=new URL(value);}catch{throw new Error('链接无效');}
  if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password) throw new Error('只支持普通 HTTP / HTTPS 链接');
  const h=u.hostname.toLowerCase();
  if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h==='[::1]'||/^\[/.test(h)||/^(0|10|127|169\.254|192\.168)\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)) throw new Error('不支持本地或内网链接');
  return u.href;
}
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,Math.max(min,max)));
export function clampPosition(point:{x:number;y:number},size:{width:number;height:number},area:{x:number;y:number;width:number;height:number}) {
  return {x:Math.round(clamp(point.x,area.x,area.x+area.width-size.width)),y:Math.round(clamp(point.y,area.y,area.y+area.height-size.height))};
}
export function lookDirection(dx:number,dy:number):number|null {if(Math.hypot(dx,dy)<30)return null;return Math.round((Math.atan2(dx,-dy)*180/Math.PI+360)%360/22.5)%16;}
export function roamingTarget(center:number,current:number,area:{x:number;width:number},width:number,random:()=>number=Math.random):number {
  const distance=40+random()*60; const left=Math.max(area.x,center-180),right=Math.min(area.x+area.width-width,center+180);
  let target=clamp(current+(random()<.5?-distance:distance),left,right);
  if(Math.abs(target-current)<10)target=clamp(current+(target<=current?distance:-distance),left,right);
  return Math.round(target);
}
export function contextMessages(conversation:Conversation):any[] {
  const result:any[]=[];
  // Only complete user/assistant pairs form future API context. Failed/cancelled turns stay visible locally.
  for(let i=0;i<conversation.messages.length;i++){
    const m=conversation.messages[i],next=conversation.messages[i+1];
    if(m.role!=='user'||next?.role!=='assistant'||next.status!=='complete')continue;
    result.push({role:'user',content:m.images?.length?[{type:'text',text:m.content||'请查看这些图片。'},...m.images.map(im=>({type:'image_url',image_url:{url:im.dataUrl,detail:'auto'}}))]:m.content});
    result.push({role:'assistant',content:next.content,...(next.reasoning?{reasoning_content:next.reasoning}:{})});
    i++;
  }
  return result;
}
