import {contextBridge,ipcRenderer} from 'electron';
import type {PiggyAPI,AppState,PetState} from './shared';
const invoke=(name:string,...args:unknown[])=>ipcRenderer.invoke('piggy:'+name,...args);
function subscribe<T>(name:string,fn:(data:T)=>void){const listener=(_event:unknown,data:T)=>fn(data);ipcRenderer.on(name,listener);return()=>ipcRenderer.removeListener(name,listener);}
const api:PiggyAPI={
  state:()=>invoke('state'),settings:s=>invoke('settings',s),saveKey:k=>invoke('saveKey',k),deleteKey:()=>invoke('deleteKey'),testKey:()=>invoke('testKey'),
  send:data=>invoke('send',data),stop:()=>invoke('stop'),newChat:()=>invoke('newChat'),selectChat:id=>invoke('selectChat',id),deleteChat:id=>invoke('deleteChat',id),clearChats:()=>invoke('clearChats'),
  showPanel:kind=>invoke('showPanel',kind),closePanel:()=>invoke('closePanel'),openLink:url=>invoke('openLink',url),copy:text=>invoke('copy',text),
  showQuick:focus=>invoke('showQuick',focus===true),closeQuick:()=>invoke('closeQuick'),quickHover:(region,inside)=>ipcRenderer.send('piggy:quickHover',{region,inside}),quickResize:height=>ipcRenderer.send('piggy:quickResize',height),
  loadDraft:id=>invoke('loadDraft',id),saveDraft:(id,text)=>ipcRenderer.send('piggy:draft',{id,text}),onDraftRefresh:fn=>subscribe('piggy:draft-refresh',fn),activity:kind=>ipcRenderer.send('piggy:activity',kind),
  beginDrag:p=>ipcRenderer.send('piggy:beginDrag',p),drag:p=>ipcRenderer.send('piggy:drag',p),endDrag:()=>ipcRenderer.send('piggy:endDrag'),petHover:b=>ipcRenderer.send('piggy:hover',b),
  onState:fn=>subscribe<AppState>('piggy:state',fn),onPet:fn=>subscribe<PetState>('piggy:pet',fn)
};
contextBridge.exposeInMainWorld('piggy',api);
