/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
function load(os='android', enabled=true, fail=false) {
  const calls=[];
  const action=value=>{calls.push(value);if(fail)throw Error('unavailable');return Promise.resolve();};
  const mocks={'react-native':{Platform:{OS:os}},'./haptic-preference':{hapticsEnabled:()=>enabled},'expo-haptics':{ImpactFeedbackStyle:{Heavy:'Heavy',Medium:'Medium'},NotificationFeedbackType:{Success:'Success',Warning:'Warning',Error:'Error'},impactAsync:action,notificationAsync:action}};
  const file=path.resolve(__dirname,'../src/utils/haptics.ts'),mod=new Module(file,module);
  mocks['expo-haptics'].ImpactFeedbackStyle.Light='Light';
  mod.require=id=>mocks[id]||require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
  return {api:mod.exports,calls};
}
test('central haptics maps every feel and returns immediately',()=>{
  const app=load();for(const name of ['tabSwitch','press','lightPress','success','warning','error'])assert.equal(app.api[name](),undefined);
  assert.deepEqual(app.calls,['Heavy','Medium','Light','Success','Warning','Error']);
});
test('web and disabled settings suppress all feedback; native failures are silent',()=>{
  for(const app of [load('web'),load('android',false)]){Object.values(app.api).forEach(fn=>fn());assert.deepEqual(app.calls,[]);}
  const app=load('android',true,true);assert.doesNotThrow(()=>app.api.tabSwitch());
});
