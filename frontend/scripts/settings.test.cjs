/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function harness(file, preferenceOverrides={}, canGoBack=false){
  const state=[],effects=[],deps=[],calls=[];let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){const i=cursor++;state[i]??={current:initial};return state[i];},useEffect(fn,next){const i=cursor++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;effects.push(fn);}}};
  const player={pause(){},replace(){},play(){}};
  const prefs={medicine_reminders:true,checkup_reminders:true,reminder_sound:true,voice_reminders:false,push_enabled:false,whatsapp_linked:false,telegram_linked:false,...preferenceOverrides};
  const mocks={react,'react-native':{Text:'text',TextInput:'input',View:'view',Linking:{openURL:async()=>{}},StyleSheet:{create:v=>v,hairlineWidth:1}},'@expo/vector-icons':{Ionicons:'icon'},'expo-audio':{useAudioPlayer:()=>player},'expo-router':{useRouter:()=>({push:route=>calls.push(['route',route]),back(){}})},'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=>null,setItem:async()=>{}}},'@/src/auth-context':{useAuth:()=>({user:{id:'test',name:'Name',email:'test@example.com'},logout:async()=>calls.push(['logout']),updateProfile:async input=>calls.push(['profile',input])})},'@/src/api':{api:{notificationPreferences:async()=>prefs,saveNotificationPreferences:async v=>{calls.push(['save',v]);return v;},changePassword:async(...args)=>calls.push(['password',...args])}},'@/src/components/dawai-ui':{ScreenShell:'screen'},'@/src/components/bottom-sheet':{BottomSheet:'sheet'},'@/src/components/settings-ui':{SettingsButton:'button',SettingsGroup:'group',SettingsRow:'row',SettingsToggle:'toggle',settingsStyles:{}},'@/src/components/settings-success':{SettingsSuccess:'success'},'@/src/components/reminder-voice-recorder':{ReminderVoiceRecorder:'recorder'},'@/src/components/ui/PressableScale':{__esModule:true,default:'pressable'},'./ui/PressableScale':{__esModule:true,default:'pressable'},'@/src/utils/haptic-preference':{useHapticsEnabled:()=>true,setHapticsEnabled(){}},'@/src/utils/text-size':{useTextSize:()=>'Normal',setTextSize(){}},'@/src/utils/haptics':{press:()=>calls.push(['haptic']),success(){},error(){}}};
  mocks['expo-router'].useRouter=()=>({push:route=>calls.push(['route',route]),canGoBack:()=>canGoBack,back:()=>calls.push(['back']),replace:route=>calls.push(['replace',route])});
  const filename=path.resolve(__dirname,'../'+file),mod=new Module(filename,module);mod.require=id=>id==='@/src/components/round-back-button'?{RoundBackButton:'backbutton'}:id.endsWith('.wav')?1:mocks[id]||require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return{calls,exports:mod.exports,render(){cursor=0;const tree=mod.exports.default();while(effects.length)effects.shift()();return tree;}};
}
test('Settings is minimal, switches apply immediately, logout requires confirmation',async()=>{
  const app=harness('app/(tabs)/settings.tsx');let tree=app.render();await Promise.resolve();tree=app.render();
  assert.deepEqual(nodes(tree).filter(n=>n.type==='group').map(n=>n.props.title),[undefined,'What to remind me about','How to remind me','Comfort']);
  nodes(tree).find(n=>n.type==='row'&&n.props.label==='Profile').props.onPress();assert.deepEqual(app.calls[0],['route','/settings/profile']);
  nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Medicine reminders').props.onChange(false);
  tree=app.render();assert.ok(nodes(tree).some(n=>n.props?.children==='Medicine reminders are off. You will not be reminded to take your medicines.'));
  await Promise.resolve();assert.equal(app.calls.find(c=>c[0]==='save')[1].medicine_reminders,false);
  nodes(tree).find(n=>n.type==='button'&&n.props.label==='Log out').props.onPress();tree=app.render();
  assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props.label==='Stay logged in'));assert.ok(!app.calls.some(c=>c[0]==='logout'));
});
test('switch uses PressableScale, explicit On/Off and checked accessibility state',()=>{
  const app=harness('src/components/settings-ui.tsx');const toggle=app.exports.SettingsToggle({label:'Haptic feedback',value:true,onChange:v=>app.calls.push(['change',v])});
  assert.equal(toggle.type,'pressable');assert.equal(toggle.props.accessibilityRole,'switch');assert.equal(toggle.props.accessibilityState.checked,true);
  assert.ok(nodes(toggle).some(n=>n.props?.children==='On'));toggle.props.onPressIn();toggle.props.onPress();assert.deepEqual(app.calls,[['haptic'],['change',false]]);
});
test('Settings cards use soft teal, inset dividers and unchanged icon/switch sizes',()=>{
  const app=harness('src/components/settings-ui.tsx');const styles=app.exports.settingsStyles;
  assert.equal(styles.group.backgroundColor,'#ECF8F5');assert.equal(styles.softButton.backgroundColor,'#ECF8F5');assert.equal(styles.group.borderRadius,20);assert.equal(styles.divider.marginHorizontal,16);
  assert.equal(styles.tile.width,44);assert.equal(styles.tile.height,44);assert.equal(styles.track.width,52);assert.equal(styles.track.height,30);
  const row=app.exports.SettingsRow({icon:'person-outline',label:'Profile',prominent:true,onPress(){}});
  assert.ok(row.props.style.includes(styles.profileRow));assert.equal(styles.profileRow.minHeight,84);
});
test('turning Telegram reminders off preserves the linked account and its switch',async()=>{
  const app=harness('app/(tabs)/settings.tsx',{telegram_linked:true});app.render();await Promise.resolve();let tree=app.render();
  nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Telegram').props.onChange(false);tree=app.render();await Promise.resolve();
  assert.equal(nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Telegram').props.value,false);
  const saved=app.calls.find(c=>c[0]==='save')[1];assert.equal(saved.telegram_linked,true);assert.equal(saved.telegram_reminders,false);
});
test('voice note preference remains without a Settings recorder or sound override',async()=>{
  const app=harness('app/(tabs)/settings.tsx',{voice_reminders:true});app.render();await Promise.resolve();let tree=app.render();
  const toggle=nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Voice note reminders');assert.equal(toggle.props.value,true);
  assert.equal(nodes(tree).find(n=>n.type==='row'&&n.props.label==='Reminder sound').props.helper,'Gentle');
  assert.ok(!nodes(tree).some(n=>n.type==='recorder'||n.props?.label==='Your voice'||n.props?.label==='Record'));
  toggle.props.onChange(false);tree=app.render();await Promise.resolve();
  assert.equal(app.calls.find(c=>c[0]==='save')[1].voice_reminders,false);
  assert.equal(nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Voice note reminders').props.value,false);
});
test('staggered eye drop reminders default on and save independently',async()=>{
  const app=harness('app/(tabs)/settings.tsx');app.render();await Promise.resolve();let tree=app.render();
  const toggle=nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Staggered eye drop reminders');assert.equal(toggle.props.value,true);
  toggle.props.onChange(false);tree=app.render();await Promise.resolve();
  const saved=app.calls.find(c=>c[0]==='save')[1];assert.equal(saved.eye_drop_reminders,false);assert.equal(saved.medicine_reminders,true);assert.equal(saved.checkup_reminders,true);
  assert.equal(nodes(tree).find(n=>n.type==='toggle'&&n.props.label==='Staggered eye drop reminders').props.value,false);
});
test('Profile rejects short/mismatched passwords and saves with the current password',async()=>{
  const app=harness('app/settings/profile.tsx');let tree=app.render();nodes(tree).find(n=>n.type==='row'&&n.props.label==='Password').props.onPress();tree=app.render();
  nodes(tree).find(n=>n.type==='button'&&n.props.label==='Save password').props.onPress();tree=app.render();assert.ok(nodes(tree).some(n=>n.props?.children==='Use at least 8 characters.'));assert.equal(app.calls.length,0);
  const fields=nodes(tree).filter(n=>n.type==='input');fields[0].props.onChangeText('current-test-password');fields[1].props.onChangeText('new-test-password');fields[2].props.onChangeText('new-test-password');tree=app.render();nodes(tree).find(n=>n.type==='button'&&n.props.label==='Save password').props.onPress();await Promise.resolve();assert.deepEqual(app.calls[0],['password','current-test-password','new-test-password']);
});
test('Profile Back uses Settings fallback without history and preserves nested form navigation',()=>{
  const direct=harness('app/settings/profile.tsx');let tree=direct.render();nodes(tree).find(n=>n.type==='backbutton').props.onPress();assert.deepEqual(direct.calls,[['replace','/settings']]);
  const normal=harness('app/settings/profile.tsx',{},true);tree=normal.render();nodes(tree).find(n=>n.type==='backbutton').props.onPress();assert.deepEqual(normal.calls,[['back']]);
  const form=harness('app/settings/profile.tsx');tree=form.render();nodes(tree).find(n=>n.type==='row'&&n.props.label==='Password').props.onPress();tree=form.render();nodes(tree).find(n=>n.type==='backbutton').props.onPress();tree=form.render();assert.ok(nodes(tree).some(n=>n.type==='row'&&n.props.label==='Name'));assert.deepEqual(form.calls,[]);
});
