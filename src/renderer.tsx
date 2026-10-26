import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ROWS,PET_SIZE,type AppState,type Attachment,type Message,type PetState,type Settings} from './shared';
import './style.css';
import {recentQuickMessages} from './interactions';
const api=window.piggy;
function errorText(e:unknown){return String(e instanceof Error?e.message:e).replace(/^Error invoking remote method '[^']+': Error: /,'');}
function Icon({name,size=20}:{name:'write'|'settings'|'close'|'send'|'image'|'copy'|'plus'|'stop'|'history'|'arrow'|'expand'|'collapse';size?:number}){
 if(name==='expand'||name==='collapse')return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d={name==='expand'?'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5':'M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4'}/></svg>;
 const paths={write:<><path d="m15 4 5 5M4 16l1-5L16 0l5 5-11 11-5 1Z"/><path d="M21 13v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h6"/></>,settings:<><path d="m9 3 1-2h4l1 2 3 2 3 0 2 4-2 2v3l2 2-2 4h-3l-3 2-1 2h-4l-1-2-3-2H3l-2-4 2-2v-3L1 9l2-4h3Z"/><circle cx="12" cy="12" r="4"/></>,close:<path d="m5 5 14 14M19 5 5 19"/>,send:<><path d="m12 20 0-16m-7 7 7-7 7 7"/></>,image:<><rect x="2" y="3" width="20" height="18" rx="4"/><circle cx="8" cy="9" r="2"/><path d="m3 18 5-5 4 4 4-6 6 7"/></>,copy:<><rect x="8" y="8" width="13" height="14" rx="3"/><path d="M16 5V3H3v14h2"/></>,plus:<path d="M12 4v16M4 12h16"/>,stop:<rect x="5" y="5" width="14" height="14" rx="3"/>,history:<><path d="M3 10a9 9 0 1 1 0 6M3 3v7h7M12 7v6l4 2"/></>,arrow:<path d="m9 5 7 7-7 7"/>};
 return <svg width={size} height={size} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Pet(){
 const [pet,setPet]=useState<PetState>({action:'idle',look:null,paused:false});const [frame,setFrame]=useState(0);const drag=useRef<{x:number;y:number;moved:boolean}|null>(null);
 useEffect(()=>api.onPet(setPet),[]);
 useEffect(()=>{setFrame(0);let n=0,timer:ReturnType<typeof setTimeout>;const durations=ROWS[pet.action].durations;const advance=()=>{timer=setTimeout(()=>{n=(n+1)%durations.length;setFrame(n);advance();},durations[n]);};advance();return()=>clearTimeout(timer);},[pet.action]);
 const row=pet.action==='idle'&&pet.look!==null?9+Math.floor(pet.look/8):ROWS[pet.action].row;
 const col=pet.action==='idle'&&pet.look!==null?pet.look%8:frame;
 const start=(e:React.PointerEvent)=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.screenX,y:e.screenY,moved:false};api.beginDrag({x:e.screenX,y:e.screenY});};
 return <main className="pet-root" style={PET_SIZE}><div className="pet-content">
  <div className="pet-sprite" title="拖动 Piggy 移动位置 · 右键打开菜单" role="img" aria-label="Piggy 桌面宠物" style={{backgroundPosition:`${-col*120}px ${-row*130}px`}} onPointerEnter={()=>api.petHover(true)} onPointerLeave={()=>api.petHover(false)} onPointerDown={start} onPointerMove={e=>{if(drag.current){if(Math.hypot(e.screenX-drag.current.x,e.screenY-drag.current.y)>2)drag.current.moved=true;api.drag({x:e.screenX,y:e.screenY});}}} onPointerUp={e=>{if(drag.current){drag.current=null;api.endDrag();e.currentTarget.releasePointerCapture(e.pointerId);}}} onLostPointerCapture={()=>{if(drag.current){drag.current=null;api.endDrag();}}}/>
  <nav className="pet-controls" aria-label="Piggy 控件" onPointerEnter={()=>api.petHover(true)} onPointerLeave={()=>api.petHover(false)}><button title="悬停轻聊，点击输入" aria-label="文字对话" onPointerEnter={()=>api.quickHover('entry',true)} onPointerLeave={()=>api.quickHover('entry',false)} onClick={()=>void api.showQuick(true)}><Icon name="write" size={23}/></button><span className="separator"/><button title="设置" aria-label="设置" onClick={()=>void api.showPanel('settings')}><Icon name="settings" size={22}/></button></nav>
 </div></main>;
}
function RichText({text}:{text:string}){return <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{a:({href,children})=><a href={href} onClick={e=>{e.preventDefault();if(href)void api.openLink(href).catch(()=>{});}}>{children}</a>,img:({src,alt})=><span className="remote-image">[图片：{alt||'外部图片'}]{typeof src==='string'&&/^https?:/.test(src)&&<button onClick={()=>void api.openLink(src)}>在浏览器查看</button>}</span>,pre:({children})=><div className="code-wrap"><button className="code-copy" onClick={e=>{const code=e.currentTarget.parentElement?.querySelector('code')?.textContent;if(code)void api.copy(code);}}>复制</button><pre>{children}</pre></div>}}>{text}</Markdown>;}
function useConversationDraft(id:string):[string,(text:string)=>void]{
 const [text,setText]=useState('');const revision=useRef(0);
 useEffect(()=>{
   let alive=true;const load=()=>{const version=revision.current;void api.loadDraft(id).then(value=>{if(alive&&revision.current===version)setText(value);});};
   load();const off=api.onDraftRefresh(load);window.addEventListener('focus',load);
   return()=>{alive=false;off();window.removeEventListener('focus',load);};
 },[id]);
 const change=useCallback((value:string)=>{revision.current++;setText(value);api.saveDraft(id,value);},[id]);
 return [text,change];
}
function QuickChat({state,notify}:{state:AppState;notify:(s:string)=>void}){
 const [text,setText]=useConversationDraft(state.activeId),input=useRef<HTMLTextAreaElement>(null),shell=useRef<HTMLDivElement>(null);
 const recent=recentQuickMessages(state.conversation.messages);
 useEffect(()=>{const focus=()=>input.current?.focus();window.addEventListener('focus',focus);if(document.hasFocus())focus();return()=>window.removeEventListener('focus',focus);},[]);
 useEffect(()=>{const element=shell.current;if(!element)return;const update=()=>api.quickResize(element.getBoundingClientRect().height);const observer=new ResizeObserver(update);observer.observe(element);update();return()=>observer.disconnect();},[]);
 const send=async()=>{if(state.busy||!text.trim())return;try{await api.send({text,images:[],search:false});setText('');}catch(e){notify(errorText(e));}};
 return <div className="quick-shell" ref={shell} onPointerEnter={()=>api.quickHover('panel',true)} onPointerLeave={()=>api.quickHover('panel',false)}>
  <header className="quick-header"><div><span className={`quick-dot ${state.busy?'busy':''}`}/><strong>Piggy 轻聊</strong></div><nav><button title="放大，查看完整对话" aria-label="放大对话框" onClick={()=>void api.showPanel('chat')}><Icon name="expand" size={16}/></button><button title="收起轻聊" aria-label="收起轻聊" onClick={()=>void api.closeQuick()}><Icon name="close" size={16}/></button></nav></header>
  {!!recent.length&&<div className="quick-messages">{recent.map(m=><article key={m.id} data-testid="quick-message" className={`quick-bubble ${m.role}`} onPointerEnter={()=>{if(m.role==='assistant'&&m.status!=='generating')api.activity('read-answer');}}>
   <div className="quick-speaker">{m.role==='user'?'你':'Piggy'}</div><div className="quick-message-copy">{m.content?<RichText text={m.content}/>:m.images?.length?'图片消息，请放大查看':m.status==='generating'?<span className="quick-thinking">在想啦<span>···</span></span>:m.status==='error'?'这次没能回答，可以重试':''}</div>
   {m.error&&<div className="quick-warning">{m.error}</div>}
  </article>)}</div>}
  {!recent.length&&<p className="quick-welcome">我在这儿。有什么想和我说的吗？</p>}
  {!state.hasKey&&<button className="quick-connect" onClick={()=>void api.showPanel('settings')}>先在设置中连接 DeepSeek ↗</button>}
  <div className="quick-composer"><textarea ref={input} aria-label="轻聊输入框" placeholder="轻轻说一句…" rows={2} maxLength={60000} disabled={state.busy} value={text} onFocus={()=>api.activity('typing')} onBlur={()=>api.activity('input-blur')} onChange={e=>{setText(e.target.value);api.activity('typing');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
   <div className="quick-composer-footer"><span role="status">{state.busy?'Piggy 正在思考…':'Enter 发送 · 最多显示三条消息'}</span>{state.busy?<button className="quick-send" title="停止生成" aria-label="停止轻聊生成" onClick={()=>void api.stop()}><Icon name="stop" size={16}/></button>:<button className="quick-send" aria-label="发送轻聊消息" disabled={!state.hasKey||!text.trim()} onClick={()=>void send()}><Icon name="send" size={18}/></button>}</div>
  </div><footer className="quick-hint">图片、联网和完整记录，可在放大后使用</footer>
 </div>;
}
function Bubble({message,onRetry}:{message:Message;onRetry:()=>void}){
 const [copied,setCopied]=useState(false);
 return <article className={`message ${message.role}`} data-testid={`message-${message.role}`} onPointerEnter={()=>{if(message.role==='assistant'&&message.status!=='generating')api.activity('read-answer');}}><div className="message-label">{message.role==='user'?'你':'PIGGY'}</div>
  {!!message.images?.length&&<div className="sent-images">{message.images.map(im=>im.dataUrl?<a key={im.id} title={im.name}><img src={im.dataUrl} alt={im.name}/></a>:<span key={im.id}>图片已丢失：{im.name}</span>)}</div>}
  {message.role==='assistant'?<div className="markdown"><RichText text={message.content}/></div>:<div className="user-text">{message.content}</div>}
  {message.status==='generating'&&!message.content&&<div className="thinking-dots"><i/><i/><i/></div>}
  {message.error&&<p className="message-notice" role="status">{message.error}</p>}
  {!!message.sources?.length&&<div className="sources"><span>参考来源</span>{message.sources.map((s,i)=><button key={s.url} onClick={()=>void api.openLink(s.url).catch(()=>{})}>{i+1}. {s.title}</button>)}</div>}
  {message.role==='assistant'&&message.status!=='generating'&&<div className="message-actions">{message.content&&<button aria-label="复制回答" onClick={()=>{void api.copy(message.content);setCopied(true);setTimeout(()=>setCopied(false),1500);}}><Icon name="copy" size={13}/>{copied?'已复制':'复制'}</button>}{(message.status==='error'||message.status==='stopped')&&<button onClick={onRetry}>恢复输入并重试</button>}</div>}
 </article>;
}
function Chat({state,notify}:{state:AppState;notify:(s:string)=>void}){
 const [text,setText]=useConversationDraft(state.activeId),[images,setImages]=useState<Attachment[]>([]),[search,setSearch]=useState(state.search),[history,setHistory]=useState(false),[dragging,setDragging]=useState(false);
 const input=useRef<HTMLTextAreaElement>(null),picker=useRef<HTMLInputElement>(null),bottom=useRef<HTMLDivElement>(null),messages=useRef<HTMLDivElement>(null),follow=useRef(true);
 useEffect(()=>{setImages([]);setSearch(state.search);input.current?.focus();follow.current=true;},[state.activeId]);
 useEffect(()=>{if(follow.current)bottom.current?.scrollIntoView({behavior:'instant'});},[state.conversation.messages.map(m=>m.content.length).join(','),state.busy]);
 const addFiles=async(files:File[])=>{
   try{if(state.busy)return;if(images.length+files.length>4)throw new Error('每次最多添加四张图片。');
    const added:Attachment[]=[];
    for(const file of files){const mime=file.type||(/\.jpe?g$/i.test(file.name)?'image/jpeg':/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'');if(!['image/png','image/jpeg','image/webp'].includes(mime))throw new Error('支持 PNG、JPEG、WebP 图片。');if(file.size>10*1024*1024)throw new Error('每张图片不能超过 10 MB。');
      const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).replace(/^data:[^;]*;/,`data:${mime};`));r.onerror=()=>reject(new Error('图片读取失败'));r.readAsDataURL(file);});added.push({id:crypto.randomUUID(),name:file.name||'粘贴的图片.png',mime,dataUrl});}
    setImages(current=>{if(current.length+added.length>4){notify('每次最多添加四张图片。');return current;}api.activity('image-added');return [...current,...added];});
   }catch(e){notify(errorText(e));}
 };
 const send=async()=>{if(state.busy||!text.trim()&&!images.length)return;try{await api.send({text,images,search:search&&state.settings.allowSearch});setText('');setImages([]);follow.current=true;}catch(e){notify(errorText(e));}};
 const retry=(index:number)=>{const previous=[...state.conversation.messages.slice(0,index)].reverse().find(m=>m.role==='user');if(previous){setText(previous.content);setImages((previous.images||[]).filter(im=>im.dataUrl));input.current?.focus();notify('已恢复输入；确认后重新发送。');}};
 return <div className={`chat-layout ${dragging?'file-hover':''}`} onDragOver={e=>{e.preventDefault();if(e.dataTransfer.types.includes('Files'))setDragging(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);void addFiles(Array.from(e.dataTransfer.files));}}>
  <header className="panel-header"><div className="brand"><img src="../assets/icon.png"/><div><strong>Piggy</strong><span>在这里，慢慢说。</span></div></div><div className="header-actions"><button title="回到轻聊" aria-label="回到轻聊" onClick={async()=>{await api.closePanel();await api.showQuick(true);}}><Icon name="collapse"/></button><button title="历史对话" aria-label="历史对话" onClick={()=>setHistory(!history)}><Icon name="history"/></button><button title="新建对话" aria-label="新建对话" disabled={state.busy} onClick={()=>void api.newChat().catch(e=>notify(errorText(e)))}><Icon name="plus"/></button><button title="设置" aria-label="设置" onClick={()=>void api.showPanel('settings')}><Icon name="settings"/></button><button title="收起对话" aria-label="收起对话" onClick={()=>void api.closePanel()}><Icon name="close"/></button></div></header>
  {history&&<div className="history-list"><div className="history-title">本机历史对话 <small>仅保存在这台电脑</small></div>{state.conversations.map(c=><div key={c.id} className={c.id===state.activeId?'selected':''}><button disabled={state.busy} onClick={()=>{void api.selectChat(c.id).catch(e=>notify(errorText(e)));setHistory(false);}}>{c.title}</button><button aria-label={`删除 ${c.title}`} title="删除会话" disabled={state.busy} onClick={()=>{if(confirm('删除这段会话及其图片？此操作无法撤销。'))void api.deleteChat(c.id).catch(e=>notify(errorText(e)));}}><Icon name="close" size={14}/></button></div>)}</div>}
  {!state.hasKey&&<button className="connect-banner" onClick={()=>void api.showPanel('settings')}>先连接你的 DeepSeek，Piggy 就能开始聊天 <Icon name="arrow" size={15}/></button>}
  <div className="messages" ref={messages} onScroll={()=>{const el=messages.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<90;}}>
   {state.conversation.messages.length===0?<div className="empty-chat"><div className="empty-pet"/><h1>今天想聊些什么？</h1><p>聊个想法，给我看张图片，<br/>或开启联网，一起找找答案。</p><div className="suggestions"><button onClick={()=>setText('帮我理一理今天要做的事')}>理一理今天的事</button><button onClick={()=>picker.current?.click()}>给 Piggy 看张图片</button></div></div>:state.conversation.messages.map((m,i)=><Bubble key={m.id} message={m} onRetry={()=>retry(i)}/>)}
   <div ref={bottom}/>
  </div>
  <div className="composer-area"><div className="generation-status" role="status">{state.busy?<><span className="status-dot"/>{state.status}</>:state.conversation.messages.length?'想继续聊，也可以换个话题。':'文字 · 图片 · 联网搜索'}</div>
   <div className="composer">{!!images.length&&<div className="attachments">{images.map(im=><div key={im.id}><img src={im.dataUrl} alt={im.name}/><button aria-label={`移除 ${im.name}`} onClick={()=>setImages(images.filter(x=>x.id!==im.id))}>×</button></div>)}</div>}
    <textarea ref={input} aria-label="消息输入框" placeholder={state.hasKey?'和 Piggy 说点什么…':'先打开设置，连接 DeepSeek…'} value={text} onFocus={()=>api.activity('typing')} onBlur={()=>api.activity('input-blur')} onChange={e=>{setText(e.target.value);api.activity('typing');}} maxLength={60000} disabled={state.busy} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();void addFiles(files);}}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
    <div className="composer-tools"><div><button title="添加图片" aria-label="添加图片" disabled={state.busy} onClick={()=>picker.current?.click()}><Icon name="image"/></button><input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e=>{void addFiles(Array.from(e.target.files||[]));e.target.value='';}}/><button className={`search-toggle ${search&&state.settings.allowSearch?'active':''}`} aria-pressed={search&&state.settings.allowSearch} disabled={state.busy||!state.settings.allowSearch} onClick={()=>setSearch(!search)} title={state.settings.allowSearch?'联网调用会产生 DeepSeek API 费用':'请先在设置中允许联网搜索'}>◎ 联网搜索</button></div>
    {state.busy?<button className="send-button" aria-label="停止生成" title="停止生成" onClick={()=>void api.stop()}><Icon name="stop"/></button>:<button className="send-button" aria-label="发送消息" disabled={!state.hasKey||!text.trim()&&!images.length} onClick={()=>void send()}><Icon name="send"/></button>}</div>
   </div><p className="composer-hint">Enter 发送 · Shift + Enter 换行 · 回答仅供参考</p>
  </div>{dragging&&<div className="drop-overlay">放下图片，让 Piggy 看看</div>}
 </div>;
}
function SettingsPage({state,notify}:{state:AppState;notify:(s:string)=>void}){
 const [draft,setDraft]=useState<Settings>(state.settings),[secret,setSecret]=useState(''),[pending,setPending]=useState(false),[testing,setTesting]=useState(false);
 useEffect(()=>setDraft(state.settings),[JSON.stringify(state.settings)]);
 const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setDraft(d=>({...d,[key]:value}));
 const task=async(fn:()=>Promise<unknown>,message?:string)=>{setPending(true);try{await fn();if(message)notify(message);}catch(e){notify(errorText(e));}finally{setPending(false);}};
 return <div className="settings-layout"><header className="panel-header"><div><h1>让 Piggy 更懂你</h1><span className="muted">所有配置只保存在本机</span></div><button title="返回聊天" aria-label="返回聊天" onClick={()=>void api.showPanel('chat')}><Icon name="close"/></button></header>
 <div className="settings-scroll"><section><div className="section-heading"><h2>连接 DeepSeek</h2><span className={`badge ${state.hasKey?'connected':''}`}>{state.hasKey?'密钥已保存':'未连接'}</span></div><p className="muted">使用你自己的 API 密钥，费用由你的 DeepSeek 账户承担。</p><div className="model-info"><span>官方接口</span><strong>api.deepseek.com</strong><span>模型 · 支持图片</span><strong>deepseek-flash</strong></div>
 <label className="field">API 密钥<input aria-label="DeepSeek API 密钥" type="password" autoComplete="off" spellCheck={false} placeholder={state.hasKey?'填写新密钥以更换，已保存密钥不会显示':'粘贴你的 DeepSeek API Key'} value={secret} onChange={e=>setSecret(e.target.value)} maxLength={512}/></label><div className="button-row"><button className="primary" disabled={!secret.trim()||pending||state.busy} onClick={()=>void task(async()=>{await api.saveKey(secret);setSecret('');},'密钥已加密保存。')}>保存密钥</button><button disabled={!state.hasKey||pending||testing||state.busy} onClick={async()=>{setTesting(true);try{notify(await api.testKey());}catch(e){notify(errorText(e));}finally{setTesting(false);}}}>{testing?'正在测试…':'测试连接'}</button><button disabled={!state.hasKey||pending||state.busy} onClick={()=>{if(confirm('删除本机保存的密钥？'))void task(()=>api.deleteKey(),'密钥已删除。');}}>删除</button></div><button className="text-link" onClick={()=>void api.openLink('https://platform.deepseek.com/api_keys')}>去 DeepSeek 获取 API 密钥 ↗</button>
 </section><section><h2>回答与联网</h2><label className="switch-row"><span>深度思考<small>使用原有思考动画；复杂问题可能需要更久</small></span><input type="checkbox" checked={draft.thinking} onChange={e=>update('thinking',e.target.checked)}/></label><label className="switch-row"><span>允许联网搜索<small>聊天面板中仍需单独开启；每轮最多搜索三次、读三个网页</small></span><input type="checkbox" checked={draft.allowSearch} onChange={e=>update('allowSearch',e.target.checked)}/></label></section>
 <section><h2>Piggy 的文风</h2><p className="muted">写下你希望 Piggy 怎样说话。保存后，对下一次发送生效。</p><textarea className="personality" aria-label="Piggy 的文风" value={draft.personality} maxLength={12000} onChange={e=>update('personality',e.target.value)}/></section>
 <section><h2>桌面陪伴</h2><label className="switch-row"><span>自主散步<small>仅在空闲时，在当前位置附近走几步</small></span><input type="checkbox" checked={draft.roaming} onChange={e=>update('roaming',e.target.checked)}/></label><label className="switch-row"><span>保持置顶<small>关闭后可以被其他窗口遮住</small></span><input type="checkbox" checked={draft.topmost} onChange={e=>update('topmost',e.target.checked)}/></label></section>
 <section><h2>本机记录</h2><p className="muted">聊天和图片保存在当前 Windows 用户的应用数据目录。清除记录不会删除密钥和设置。</p><button className="danger" disabled={state.busy||pending} onClick={()=>{if(confirm('永久删除本机所有聊天和图片？此操作无法撤销。'))void task(()=>api.clearChats(),'本机聊天和图片已清除。');}}>清除全部聊天记录</button></section>
 </div><footer className="settings-footer"><span>没有语音、录音或后台屏幕采集</span><button className="primary" disabled={pending} onClick={()=>void task(()=>api.settings(draft),'设置已保存。')}>保存设置</button></footer></div>;
}
function Panel({view}:{view:string}){
 const [state,setState]=useState<AppState|null>(null),[toast,setToast]=useState('');const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notify=(value:string)=>{setToast(value);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),6000);};
 useEffect(()=>{const off=api.onState(setState);void api.state().then(setState).catch(e=>notify(errorText(e)));return off;},[]);
 if(!state)return <div className="loading">Piggy 正在醒来…{toast&&<p>{toast}</p>}</div>;
 return <><>{view==='settings'?<SettingsPage state={state} notify={notify}/>:view==='quick'?<QuickChat key={state.activeId} state={state} notify={notify}/>:<Chat key={state.activeId} state={state} notify={notify}/>}</>{toast&&<div className="toast" role="alert" onClick={()=>setToast('')}>{toast}</div>}</>;
}
const view=new URLSearchParams(location.search).get('view')||'pet';
document.title=view==='pet'?'Piggy':view==='quick'?'Piggy · 轻聊':view==='settings'?'Piggy · 设置':'Piggy · 对话';
document.body.className=view==='pet'?'pet-body':view==='quick'?'quick-body':'panel-body';
createRoot(document.getElementById('root')!).render(view==='pet'?<Pet/>:<Panel view={view}/>);
