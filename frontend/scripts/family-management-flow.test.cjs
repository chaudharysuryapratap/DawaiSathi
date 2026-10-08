/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
function harness(owner = true, fontScale = 1, inviteCode) {
  const states = [], calls = []; let cursor = 0;
  const group = {id:'family', name:'Test Family', owner_user_id:'owner'};
  const mocks = {
    react:{useState(initial){const i=cursor++; if(!(i in states))states[i]=initial; return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useEffect(){}},
    'react-native':{Platform:{OS:'android'},View:'view',Text:'text',Pressable:'button',ScrollView:'scroll',KeyboardAvoidingView:'keyboard',Linking:{},Share:{},useWindowDimensions:()=>({width:393,fontScale})},
    'expo-linear-gradient':{LinearGradient:'gradient'},
    '@expo/vector-icons':{Ionicons:'icon',MaterialCommunityIcons:'icon'},'expo-clipboard':{},'react-native-qrcode-svg':'qr',
    'expo-router':{Stack:{Screen:'screen'},useLocalSearchParams:()=>({inviteCode}),useRouter:()=>({back(){}})},
    '@/src/components/family-group-selector':{FamilyGroupSelector:'family-access'},
    '@/src/components/family-invite-sheet':{FamilyInviteSheet:'family-invite'},
    '@/src/components/delete-confirmation':{DeleteConfirmation:'delete-confirmation'},
    '@/src/auth-context':{useAuth:()=>({user:{id:owner?'owner':'guest'}})},
    '@/src/theme':{useTheme:()=>({colors:{}})},
    '@/src/api':{api:{}},
    '@/src/data-context':{useData:()=>({activeFamilyGroup:group,activeFamilyGroupId:'family',members:[{id:'person',name:'Person',role:'member'}],familyGroups:[group],refresh:async()=>{},setActiveFamilyGroup:id=>calls.push(['active',id])})},
    '@/src/components/focus-input':{TextInput:'input'},'@/src/components/bottom-sheet':{BottomSheet:'sheet'},'@/src/components/dawai-ui':{PrimaryButton:'primary'},'@/src/components/family-qr-scanner':{FamilyQrScanner:'scanner'},'@/src/family-code':{familyJoinUrl:()=>''},
    '@/src/family-management':{familyManagement:{preview:async code=>{calls.push(['preview',code]);return{family_group_id:'other',name:'Other Family',owner_name:'Other owner',member_count:2,expires_at:'2026-10-15'};},accept:async code=>{calls.push(['accept',code]);return{family_group_id:'other'};}}},
  };
  const filename=path.resolve(__dirname,'../app/care/family-management.tsx'), loaded=new Module(filename,module);
  loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  const render=()=>{cursor=0;return loaded.exports.default();};
  return {calls,nodes:()=>nodes(render())};
}
const action=(app,label)=>app.nodes().find(n=>n.props?.accessibilityLabel===label&&n.type==='button')||app.nodes().find(n=>n.props?.label===label);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('management reuses the Home family access component at all text sizes',()=>{
  for(const scale of [1,1.4]){
    const app=harness(true,scale);
    const container=app.nodes().find(n=>n.type==='family-access');
    assert.equal(container.props.accessOnly,true);
    assert.ok(app.nodes().some(n=>n.type==='gradient'&&nodes(n).some(child=>child.props?.children==='Current family')));
  }
});
test('home presents management actions and gates owner controls',()=>{
  const app=harness();
  for(const label of ['Switch family','Rename family','Delete family','Family members','Invitations','Recently deleted','Leave family'])assert.ok(action(app,label),label);
  const guest=harness(false);
  for(const label of ['Rename family','Delete family','Invitations','Recently deleted'])assert.ok(!action(guest,label),label);
});
test('joining previews the family before explicit acceptance',async()=>{
  const app=harness(true,1,'FAM-TEST');
  app.nodes().find(n=>n.type==='input'&&n.props.accessibilityLabel==='Invite code').props.onChangeText('FAM-TEST');
  action(app,'Continue').props.onPress();await tick();
  assert.deepEqual(app.calls,[['preview','FAM-TEST']]);
  assert.ok(app.nodes().some(n=>n.props?.children==='Join Other Family?'));
  action(app,'Join family').props.onPress();await tick();
  assert.deepEqual(app.calls.slice(1),[['accept','FAM-TEST'],['active','other']]);
});
test('invitation and deletion use the shared Home sheets; only two role choices remain',()=>{
  const app=harness();action(app,'Family members').props.onPress();
  action(app,'Invite family member').props.onPress();
  assert.equal(app.nodes().find(n=>n.type==='family-invite').props.group.id,'family');
  action(app,'Add family member').props.onPress();
  assert.ok(app.nodes().some(n=>n.props?.children==='Caretaker'));
  assert.ok(!app.nodes().some(n=>n.props?.children==='Patient'));
  const home=harness();action(home,'Delete family').props.onPress();
  const sheet=home.nodes().find(n=>n.type==='sheet');
  assert.equal(sheet.props.appearance,'family');
  assert.equal(home.nodes().find(n=>n.type==='delete-confirmation').props.label,'Delete family');
});
test('members show a separate count and put Add below Invite',()=>{
  const app=harness();action(app,'Family members').props.onPress();
  const tree=app.nodes();
  assert.ok(tree.some(n=>n.props?.children==='1 member'));
  const labels=tree.filter(n=>n.type==='primary').map(n=>n.props.label);
  assert.deepEqual(labels,['Invite family member','Add family member']);
  const row=action(app,'Person');
  assert.equal(row.props.style.borderWidth,1);
});
