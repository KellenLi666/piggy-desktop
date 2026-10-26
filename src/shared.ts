export const ROWS = {
  idle: {row:0, durations:[280,110,110,140,140,320]},
  'running-right': {row:1, durations:[120,120,120,120,120,120,120,220]},
  'running-left': {row:2, durations:[120,120,120,120,120,120,120,220]},
  waving: {row:3, durations:[140,140,140,280]},
  jumping: {row:4, durations:[140,140,140,140,280]},
  failed: {row:5, durations:[140,140,140,140,140,140,140,240]},
  waiting: {row:6, durations:[150,150,150,150,150,260]},
  running: {row:7, durations:[120,120,120,120,120,220]},
  review: {row:8, durations:[150,150,150,150,150,280]}
} as const;
export type PetAction = keyof typeof ROWS;
export const PET_SIZE = {width:180,height:210} as const;
export type Settings = { personality:string; thinking:boolean; allowSearch:boolean; roaming:boolean; topmost:boolean };
export const DEFAULT_SETTINGS:Settings = {personality:'你是 Piggy，一只友好、自然、表达清楚的猫咪助手。默认用简洁的中文回答，必要时耐心解释。', thinking:true, allowSearch:true, roaming:true, topmost:true};
export type Attachment = {id:string; name:string; mime:string; dataUrl:string};
export type Source = {title:string; url:string};
export type Message = {id:string; role:'user'|'assistant'; content:string; images?:Attachment[]; status?:'complete'|'generating'|'stopped'|'error'; error?:string; reasoning?:string; sources?:Source[]};
export type Conversation = {id:string; title:string; updated:number; messages:Message[]};
export type Summary = Omit<Conversation,'messages'>;
export type AppState = {settings:Settings; hasKey:boolean; conversations:Summary[]; activeId:string; conversation:Conversation; busy:boolean; search:boolean; status:string; error?:string};
export type PetState = {action:PetAction; look:number|null; paused:boolean};
export type SendInput = {text:string; images:Attachment[]; search:boolean};
export type UIActivity = 'typing'|'input-blur'|'image-added'|'read-answer';
export type PiggyAPI = {
  state():Promise<AppState>; settings(input:Settings):Promise<void>; saveKey(value:string):Promise<void>; deleteKey():Promise<void>; testKey():Promise<string>;
  send(input:SendInput):Promise<void>; stop():Promise<void>; newChat():Promise<void>; selectChat(id:string):Promise<void>; deleteChat(id:string):Promise<void>; clearChats():Promise<void>;
  showPanel(kind:'chat'|'settings'):Promise<void>; closePanel():Promise<void>; openLink(url:string):Promise<void>; copy(text:string):Promise<void>;
  showQuick(focus?:boolean):Promise<void>; closeQuick():Promise<void>; quickHover(region:'entry'|'panel',inside:boolean):void; quickResize(height:number):void;
  loadDraft(id:string):Promise<string>; saveDraft(id:string,text:string):void; onDraftRefresh(fn:()=>void):()=>void; activity(kind:UIActivity):void;
  beginDrag(point:{x:number;y:number}):void; drag(point:{x:number;y:number}):void; endDrag():void; petHover(inside:boolean):void;
  onState(fn:(state:AppState)=>void):()=>void; onPet(fn:(state:PetState)=>void):()=>void;
};
declare global { interface Window { piggy:PiggyAPI } }
