/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
function harness() {
  let cursor=0; const states=[];
  const mocks={
    react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==="function"?initial():initial;return [states[i],v=>{states[i]=typeof v==="function"?v(states[i]):v;}];},useMemo:fn=>fn(),useRef:v=>({current:v}),useEffect:()=>{}},
    "react-native":{Animated:{FlatList:"list",View:"animated-view",Value:class{interpolate(){return 1;}setValue(){}},event:()=>()=>{}},FlatList:"list",Pressable:"button",Text:"text",View:"view"},
    "react-native-svg":{__esModule:true,default:"svg",Circle:"circle"},
    "@/src/theme":{useTheme:()=>({colors:{}})}
  };
  const filename=path.resolve(__dirname,"../src/components/history-date-dial.tsx"), loaded=new Module(filename,module);
  loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return {api:loaded.exports,render(){cursor=0;return loaded.exports.HistoryDateDial({taken:{},missed:{}});}};
}
test("date offsets cross month and year boundaries without UTC date drift",()=>{
  const {api}=harness();
  assert.equal(api.localDayKey(api.offsetDay(new Date(2026,0,1),-1)),"2025-12-31");
  assert.equal(api.localDayKey(api.offsetDay(new Date(2024,1,28),1)),"2024-02-29");
  assert.equal(api.dialIndex(76,76),1);assert.equal(api.dialIndex(0,76),0);
});
test("dial initializes today at center and snaps a single card rather than a page",()=>{
  const app=harness();
  app.render().props.onLayout({nativeEvent:{layout:{width:350}}});
  const list=app.render().props.children;
  assert.equal(list.props.initialScrollIndex,120);
  assert.equal(list.props.snapToInterval,78);
  assert.equal(list.props.disableIntervalMomentum,false);
  assert.equal(list.props.decelerationRate,"fast");
  assert.equal(list.props.pagingEnabled,undefined);
  assert.equal(app.api.localDayKey(list.props.data[120]),app.api.localDayKey(new Date()));
  assert.equal(list.props.contentContainerStyle.paddingLeft,(350-78)/2);
  assert.equal(list.props.contentContainerStyle.paddingRight,4);
  assert.equal(list.props.data.length,121);
  assert.equal(list.props.bounces,false);
  const card=list.props.renderItem({item:list.props.data[120],index:120}).props.children;
  assert.equal(card.props.accessibilityState.selected,true);
  assert.equal(card.props.style.minHeight,128);
  assert.equal(card.props.style.width,70);
});
test("scrolling extends history without selecting the centered date; tapping selects it",()=>{
  const app=harness();app.render().props.onLayout({nativeEvent:{layout:{width:350}}});
  const first=app.render().props.children;
  const date=first.props.data[10];
  first.props.onMomentumScrollEnd({nativeEvent:{contentOffset:{x:780}}});
  const extended=app.render().props.children;
  assert.equal(extended.props.data.length,241);
  assert.equal(app.api.localDayKey(extended.props.data[130]),app.api.localDayKey(date));
  assert.equal(app.api.localDayKey(extended.props.data.at(-1)),app.api.localDayKey(new Date()));
  const card=extended.props.renderItem({item:date,index:130}).props.children;
  assert.equal(card.props.accessibilityState.selected,false);
  card.props.onPress();
  const selected=app.render().props.children;
  assert.equal(selected.props.renderItem({item:date,index:130}).props.children.props.accessibilityState.selected,true);
});
