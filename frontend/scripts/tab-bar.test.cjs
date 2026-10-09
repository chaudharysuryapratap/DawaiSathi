/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function harness({os='web',reduced=false,attention=[{kind:'missed-dose'}],bottom=34,prevented=false}={}){
  const calls=[];
  class Value{constructor(value){this.value=value;}stopAnimation(){}setValue(value){this.value=value;}interpolate(options){return options.outputRange[this.value===1?1:0];}}
  const mocks={react:{useState:initial=>[initial(),()=>{}],useEffect:fn=>fn()},'react-native':{Animated:{Value,View:'animated',timing:(value,options)=>({start(){calls.push(['animation',options]);value.value=options.toValue;}})},Platform:{OS:os},StyleSheet:{create:value=>value,absoluteFill:{position:'absolute'}},Text:'text',View:'view'},'expo-router':{Tabs:'tabs'},'expo-haptics':{selectionAsync:async()=>{calls.push(['haptic']);}},'@expo/vector-icons':{MaterialCommunityIcons:'icon'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom})},'@/src/data-context':{useData:()=>({attention})},'@/src/tab-bar-metrics':{TAB_BAR_HEIGHT:72},'./ui/PressableScale':{__esModule:true,default:'button'},'./ui/useReduceMotion':{useReduceMotion:()=>reduced}};
  mocks['@/src/utils/haptics']={tabSwitch:()=>{if(os!=='web')calls.push(['haptic']);}};
  const filename=path.resolve(__dirname,'../src/components/elderly-tab-bar.tsx'),loaded=new Module(filename,module);loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  const state={index:0,routes:['index','care','history','settings'].map(name=>({name,key:name,params:{keep:true}}))};
  const navigation={emit:event=>{calls.push(['emit',event]);return{defaultPrevented:prevented};},navigate:(...args)=>calls.push(['navigate',...args])};
  const tree=loaded.exports.ElderlyTabBar({state,navigation});
  return{calls,tree,items:tree.props.children.map(child=>loaded.exports.TabItem(child.props)),children:tree.props.children};
}
test('full-width bar preserves all four routes and safe-area dimensions',()=>{
  const app=harness(),style=Object.assign({},...app.tree.props.style);
  assert.equal(style.height,106);assert.equal(style.paddingBottom,42);assert.equal(style.paddingTop,6);assert.equal(style.gap,4);assert.equal(style.width,'100%');
  assert.deepEqual(app.children.map(child=>child.props.label),['Today','Care','History','Settings']);
  for(const item of app.items){assert.equal(item.props.accessibilityRole,'tab');assert.equal(item.props.scaleTo,1);assert.equal(item.props.style.minHeight,56);assert.equal(nodes(item).find(n=>n.type==='text').props.maxFontSizeMultiplier,1.3);assert.equal(nodes(item).find(n=>n.type==='icon').props.size,26);const pill=nodes(item).find(n=>n.type==='animated'&&n.props.style[0]?.width===60);assert.equal(pill.props.style[0].height,34);}
  assert.equal(app.items[0].props['aria-selected'],true);assert.equal(app.items[1].props.accessibilityState.selected,false);
});
test('Care has no attention dot, even when a family has missed doses',()=>{
  const app=harness();assert.equal(nodes(app.items[0]).some(n=>n.props?.testID==='care-attention-dot'),false);
  assert.equal(nodes(app.items).some(n=>n.props?.testID==='care-attention-dot'),false);
  assert.equal(app.items[1].props.accessibilityLabel,'Care');
  assert.equal(nodes(harness({attention:[]}).items).some(n=>n.props?.testID==='care-attention-dot'),false);
});
test('tab changes preserve navigation events, prevent-default and native-only haptics',()=>{
  const app=harness({os:'android'});app.items[1].props.onPressIn();assert.ok(app.calls.some(c=>c[0]==='haptic'));assert.ok(!app.calls.some(c=>c[0]==='navigate'));app.items[1].props.onPress();assert.deepEqual(app.calls.find(c=>c[0]==='navigate'),['navigate','care',{keep:true}]);
  const web=harness();web.items[1].props.onPress();assert.ok(!web.calls.some(c=>c[0]==='haptic'));
  const selected=harness({os:'android'});selected.items[0].props.onPressIn();assert.ok(selected.calls.some(c=>c[0]==='haptic'));selected.items[0].props.onPress();assert.ok(!selected.calls.some(c=>c[0]==='navigate'));
  const blocked=harness({os:'android',prevented:true});blocked.items[1].props.onPress();assert.ok(!blocked.calls.some(c=>c[0]==='navigate'||c[0]==='haptic'));
});
test('selection background uses 180ms transitions, skipped under Reduce Motion',()=>{
  assert.ok(harness().calls.some(c=>c[0]==='animation'&&c[1].duration===180));
  assert.ok(!harness({reduced:true}).calls.some(c=>c[0]==='animation'));
});
test('press shrinks only the icon pill and respects Reduce Motion',()=>{
  const app=harness();app.items[0].props.onPressIn();assert.ok(app.calls.some(c=>c[0]==='animation'&&c[1].toValue===.92&&c[1].duration===120));
  const reduced=harness({reduced:true});reduced.items[0].props.onPressIn();assert.equal(reduced.calls.length,0);
});
test('native press and selection never mix JS color animation on an animated node',()=>{
  const app=harness({os:'android'});
  app.items[0].props.onPressIn();
  assert.ok(app.calls.filter(c=>c[0]==='animation').every(c=>c[1].useNativeDriver===true));
  for(const item of app.items){
    const animated=nodes(item).filter(n=>n.type==='animated');
    const scaleLayer=animated.find(n=>n.props.style?.[1]?.transform);
    assert.equal(scaleLayer.props.style[1].backgroundColor,undefined);
    const tintLayer=animated.find(n=>n.props.style?.[1]?.opacity);
    assert.equal(tintLayer.props.style[1].backgroundColor,'#E1F5EE');
    assert.equal(tintLayer.props.style[1].transform,undefined);
  }
});
