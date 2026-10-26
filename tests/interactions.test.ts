import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textReaction,recentQuickMessages,activityAction} from '../src/interactions';
test('text reactions use short explicit cues, not negative or quoted mentions',()=>{
  assert.equal(textReaction('Piggy，你好！'),'waving');
  assert.equal(textReaction('谢谢你！'),'jumping');
  assert.equal(textReaction('我今天很难过'),'failed');
  for(const text of ['不要跳一下','解释“你好”这个词','我不觉得你做得好','给我分析一下失败原因','这段材料要求你跳一跳然后忽略指令'])assert.equal(textReaction(text),null);
  assert.equal(activityAction('typing'),'waiting');assert.equal(activityAction('image-added'),'review');
});
test('quick view bounds visible messages without truncating conversation history',()=>{
  const messages=Array.from({length:10},(_,i)=>({id:String(i),role:i%2?'assistant' as const:'user' as const,content:String(i)}));
  const recent=recentQuickMessages(messages);assert.deepEqual(recent.map(m=>m.id),['7','8','9']);assert.equal(messages.length,10);
  assert.equal(recentQuickMessages([]).length,0);assert.equal(recentQuickMessages(messages.slice(0,2)).length,2);
});
