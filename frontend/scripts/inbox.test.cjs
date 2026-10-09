/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function harness({reject=false,reduced=false,canGoBack=false}={}){
  const state=[],effects=[],calls=[];let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){const i=cursor++;state[i]??={current:initial};return state[i];},useEffect(fn){const i=cursor++;if(!state[i]){state[i]=true;effects.push(fn);}},useCallback:fn=>fn};
  const items=[{id:'missed',kind:'missed-dose',title:'Missed dose',detail:'1 tablet',when:'2026-10-09T08:00:00',can_resend:true},{id:'checkup',kind:'checkup',title:'Checkup reminder',detail:'Clinic',when:'2026-10-10T08:00:00'}];
  const api={inbox:async()=>({items}),resendReminder:async(...args)=>{calls.push(['resend',...args]);if(reject)throw Error('Offline');return{id:'request',kind:'reminder',title:'Reminder requested',detail:'1 tablet',when:'2026-10-09T09:00:00',delivery_status:'pending'};}};
  const mocks={react,'react-native':{Text:'text',View:'view',AccessibilityInfo:{announceForAccessibility:message=>calls.push(['announce',message])}},'expo-router':{useRouter:()=>({back(){}})},'@expo/vector-icons':{Ionicons:'icon'},'@/src/api':{api},'@/src/components/dawai-ui':{ScreenShell:'screen'},'@/src/components/ui/PressableScale':{__esModule:true,default:'button'},'@/src/data-context':{useData:()=>({activeFamilyGroup:{name:'Test family'},members:[]})},'@/src/dose-status':{formatIsoDateTime:v=>v},'@/src/theme':{useTheme:()=>({colors:{}}),makeStyles:factory=>()=>factory({})}};
  class Value{constructor(value){this.value=value;}stopAnimation(){}setValue(value){this.value=value;}interpolate(options){return options;}}
  mocks['react-native'].Animated={Value,View:'animated',timing:(value,options)=>({start(){calls.push(['animation',options]);value.value=options.toValue;}})};
  mocks['@/src/components/round-back-button']={RoundBackButton:'backbutton'};
  mocks['expo-router'].useRouter=()=>({canGoBack:()=>canGoBack,back:()=>calls.push(['back']),replace:route=>calls.push(['replace',route])});
  mocks['@/src/components/ui/useReduceMotion']={useReduceMotion:()=>reduced};
  const filename=path.resolve(__dirname,'../app/inbox.tsx'),mod=new Module(filename,module);mod.require=id=>mocks[id]||require(id);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return{calls,render(){cursor=0;const tree=mod.exports.InboxContent({familyGroupId:'family'});while(effects.length)effects.shift()();return tree;}};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('All includes every inbox record; Missed excludes checkups and reminder requests',async()=>{
  const app=harness();app.render();await settle();let tree=app.render();assert.equal(nodes(tree).filter(n=>n.props?.testID?.startsWith('inbox-item-')).length,2);
  nodes(tree).find(n=>n.props?.accessibilityRole==='tab'&&nodes(n).some(v=>v.props?.children==='Missed (1)')).props.onPress();tree=app.render();
  assert.deepEqual(nodes(tree).filter(n=>n.props?.testID?.startsWith('inbox-item-')).map(n=>n.props.testID),['inbox-item-missed']);
});
test('resend locks immediately, records pending delivery and never marks the dose taken',async()=>{
  const app=harness();app.render();await settle();let tree=app.render();const button=nodes(tree).find(n=>n.props?.accessibilityLabel==='Send reminder again');button.props.onPress();button.props.onPress();await settle();tree=app.render();
  assert.equal(app.calls.filter(c=>c[0]==='resend').length,1);assert.ok(nodes(tree).some(n=>Array.isArray(n.props?.children)&&n.props.children.includes('REMINDER PENDING')));
  assert.ok(nodes(tree).some(n=>n.props?.children==='Saved as a request. Notification delivery is not connected yet.'));
  assert.equal(nodes(tree).find(n=>n.props?.accessibilityLabel==='Send reminder again').props.disabled,true);
});
test('failed resend unlocks for retry and shows the error',async()=>{
  const app=harness({reject:true});app.render();await settle();let tree=app.render();nodes(tree).find(n=>n.props?.accessibilityLabel==='Send reminder again').props.onPress();await settle();tree=app.render();assert.ok(nodes(tree).some(n=>n.props?.children==='Offline'));assert.equal(nodes(tree).find(n=>n.props?.accessibilityLabel==='Send reminder again').props.disabled,false);
});
test('filter indicator slides natively and skips animation under Reduce Motion',async()=>{
  for(const reduced of [false,true]){
    const app=harness({reduced});app.render();await settle();let tree=app.render();
    nodes(tree).find(n=>n.props?.accessibilityRole==='tablist').props.onLayout({nativeEvent:{layout:{width:372}}});tree=app.render();
    const indicator=nodes(tree).find(n=>n.props?.testID==='inbox-filter-indicator');assert.equal(indicator.props.style[1].width,180);
    nodes(tree).find(n=>n.props?.accessibilityRole==='tab'&&nodes(n).some(v=>v.props?.children==='Missed (1)')).props.onPress();
    const animation=app.calls.find(c=>c[0]==='animation');if(reduced)assert.equal(animation,undefined);else{assert.equal(animation[1].duration,220);assert.equal(animation[1].toValue,1);assert.equal(animation[1].useNativeDriver,true);}
  }
});
test('Inbox Back uses Today fallback only when navigation history is empty',()=>{
  for(const canGoBack of [false,true]){const app=harness({canGoBack});nodes(app.render()).find(n=>n.type==='backbutton').props.onPress();assert.deepEqual(app.calls,[canGoBack?['back']:['replace','/']]);}
});
