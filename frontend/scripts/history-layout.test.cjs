/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
function harness({ empty = false } = {}) {
  const states = []; let cursor = 0;
  const now = new Date(), date = [now.getFullYear(), String(now.getMonth()+1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
  const mocks = {
    react: { useState: initial => { const i=cursor++; if (!(i in states)) states[i]=typeof initial==="function"?initial():initial; return [states[i], v=>{states[i]=typeof v==="function"?v(states[i]):v;}]; }, useMemo: fn=>fn() },
    "react-native": { Pressable:"button", ScrollView:"scroll", Text:"text", View:"view", StyleSheet:{create:v=>v,hairlineWidth:1} },
    "@expo/vector-icons": {Ionicons:"icon"},
    "@/src/components/history-date-dial": {HistoryDateDial:"date-dial",localDayKey:()=>date},
    "@/src/theme": {useTheme:()=>({colors:{}}),makeStyles:fn=>()=>fn({brandTertiary:"existing-light-teal",surfaceSecondary:"existing-light-surface"})},
    "@/src/components/dawai-ui": {ScreenShell:"screen",LoadingState:"loading",ErrorState:"error"},
    "@/src/dose-status": {formatIsoDate:v=>v,formatTime:v=>v},
    "@/src/data-context": {useData:()=>({
      history:empty?[]:[{id:"dose",medicine_id:"med",medicine_name:"Test medicine",dosage:"1 tablet",time:"08:00",logged_at:`${date}T08:00:00`,local_date:date,member_id:"member"}],
      protocolHistory:[],missedDoseHistory:empty?[]:[{id:"miss",medicine_name:"Missed medicine",dosage:"1 tablet",time:"09:00",local_date:date,member_id:"member",source_type:"medicine"}],
      medicines:[],protocols:[],members:[{id:"member",name:"Test member"}],activeMember:null,activeMemberId:null,setActiveMember:()=>{},loading:false,error:null,refresh:()=>{}
    })},
  };
  const filename=path.resolve(__dirname,"../app/(tabs)/history.tsx"), loaded=new Module(filename,module);
  loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return {api:loaded.exports,tree(){cursor=0;return loaded.exports.default();}};
}
const nodes=n=>!n||typeof n!=="object"?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const find=(tree,id)=>nodes(tree).find(n=>n.props?.testID===id);
const has=(tree,value)=>nodes(tree).some(n=>n.props?.children===value);
test("adherence uses recorded Taken and Missed events without a Skipped state",()=>{
  const app=harness(),tree=app.tree();
  assert.ok(has(tree,"50%")); assert.ok(!has(tree,"Skipped"));
  assert.ok(nodes(tree).find(n=>n.type==="date-dial"));
  assert.equal(find(tree,"history-filter-status-all").props.label,"All (2)");assert.equal(find(tree,"history-filter-status-taken").props.label,"Taken (1)");assert.equal(find(tree,"history-filter-status-missed").props.label,"Missed (1)");
});
test("status and advanced filters still work",()=>{
  const app=harness();
  find(app.tree(),"history-filter-status-missed").props.onPress();
  assert.ok(has(app.tree(),"Missed medicine"));assert.ok(!has(app.tree(),"Test medicine"));
  assert.equal(find(app.tree(),"history-range-filter"),undefined);
  find(app.tree(),"history-more-filters").props.onPress();
  assert.ok(find(app.tree(),"history-range-filter"));
});
test("empty history never displays a false adherence percentage",()=>{
  const tree=harness({empty:true}).tree();
  assert.ok(has(tree,"—"));assert.ok(!has(tree,"0%"));assert.ok(!has(tree,"100%"));assert.ok(has(tree,"No records on this date"));
});
test("selected date filters history rows and status counts even outside the summary range",()=>{
  const app=harness();
  nodes(app.tree()).find(n=>n.type==="date-dial").props.onSelectDate("2000-01-01");
  const tree=app.tree();
  assert.equal(find(tree,"history-filter-status-all").props.label,"All (0)");
  assert.ok(!has(tree,"Test medicine"));assert.ok(!has(tree,"Missed medicine"));
  assert.ok(has(tree,"No records on this date"));
});
test("History uses the existing light palette instead of overriding the screen theme",()=>{
  const tree=harness().tree();
  assert.equal(tree.props.backgroundColor,undefined);
  assert.equal(find(tree,"history-adherence").props.style.backgroundColor,"existing-light-teal");
  assert.ok(nodes(tree).find(n=>n.type==="date-dial"));
});
test("Taken late uses the scheduled history date and the existing 30 minute allowance",()=>{
  const {api}=harness();
  assert.equal(api.isHistoryTakenLate({local_date:"2026-10-08",time:"08:00",logged_at:"2026-10-08T08:30:00"}),false);
  assert.equal(api.isHistoryTakenLate({local_date:"2026-10-08",time:"08:00",logged_at:"2026-10-08T08:50:00"}),true);
  assert.equal(api.isHistoryTakenLate({local_date:"2026-10-08",time:"23:50",logged_at:"2026-10-09T00:40:00"}),true);
});
