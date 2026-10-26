import type {Message,PetAction,UIActivity} from './shared';

// Deliberately narrow local cues, not model output or executable commands.
export function textReaction(input:string):PetAction|null {
  const text=input.trim().toLowerCase().replace(/[，。！？!?~～、\s]/g,'');
  if(!text||text.length>36)return null;
  if(/^(?:piggy|小猫|猫猫)?(?:你好|嗨|哈喽|hello|hi|早上好|早安|晚安|挥挥手|挥个爪|打个招呼)(?:piggy|呀|啊|喵)?$/.test(text))return 'waving';
  if(/^(?:piggy|小猫|猫猫)?(?:谢谢|谢谢你|太棒了|你真棒|做得好|好厉害|爱你|跳一下|跳一跳)(?:piggy|呀|啊|喵)?$/.test(text))return 'jumping';
  if(/^(?:我今天|我|今天)?(?:很难过|不开心|心情不好|有点难过|好伤心)$/.test(text))return 'failed';
  return null;
}
export function activityAction(kind:UIActivity):PetAction {
  return ({typing:'waiting','input-blur':'idle','image-added':'review','read-answer':'review'} as const)[kind];
}
export function recentQuickMessages(messages:Message[]):Message[] {return messages.slice(-3);}
