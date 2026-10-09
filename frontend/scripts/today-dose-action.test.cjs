/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
function harness(reduced=false){
  const state=[],deps=[],effects=[],calls=[];let cursor=0;
  class Value{constructor(value){this.value=value;}setValue(value){this.value=value;}stopAnimation(){}}
  const mocks={
    react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],()=>{}];},useRef(initial){const i=cursor++;state[i]??={current:initial};return state[i];},useEffect(fn,next){const i=cursor++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;effects.push(fn);}}},
    'react-native':{Animated:{Value,View:'animated',spring:(value,options)=>({start(){calls.push(['spring',options]);value.value=options.toValue;}}),timing:(value,options)=>({start(){calls.push(['timing',options]);value.value=options.toValue;}})},Text:'text',View:'view'},
    '@expo/vector-icons':{Ionicons:'icon'},'expo-haptics':{NotificationFeedbackType:{Success:'success',Warning:'warning'},notificationAsync:type=>{calls.push(['haptic',type]);return Promise.resolve();}},
    './ui/PressableScale':{__esModule:true,default:'button'},'./ui/useReduceMotion':{useReduceMotion:()=>reduced},'@/src/theme':{useTheme:()=>({colors:{brandPrimary:'teal'}})}
  };
  mocks['@/src/utils/haptics']={success:()=>calls.push(['haptic','success']),warning:()=>calls.push(['haptic','warning'])};
  const filename=path.resolve(__dirname,'../src/components/today-dose-action.tsx'),loaded=new Module(filename,module);loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return{calls,render(loggedAt=null){cursor=0;const tree=loaded.exports.TodayDoseAction({loggedAt,disabled:false,testID:'dose',onToggle:()=>calls.push(['toggle'])});while(effects.length)effects.shift()();return tree.props.children.props.children;}};
}
test('taken pop only follows a user action; haptic and optimistic callback are immediate',()=>{
  const app=harness();let button=app.render();button.props.onPress({stopPropagation(){}});
  assert.deepEqual(app.calls,[['toggle'],['haptic','success']]);
  button=app.render('2026-10-09T09:10:00');assert.equal(app.calls[2][0],'spring');assert.equal(app.calls[2][1].tension,180);
  app.render('2026-10-09T09:10:01');assert.equal(app.calls.length,3);
  button.props.onPress({stopPropagation(){}});app.render();assert.equal(app.calls[4][1],'warning');assert.equal(app.calls[5][1].duration,200);
  const loaded=harness();loaded.render('2026-10-09T09:10:00');assert.deepEqual(loaded.calls,[]);
});
test('Reduce Motion skips transitions but keeps both action callbacks and haptics',()=>{
  const app=harness(true);app.render().props.onPress({stopPropagation(){}});app.render('2026-10-09T09:10:00');
  assert.deepEqual(app.calls,[['toggle'],['haptic','success']]);
});
