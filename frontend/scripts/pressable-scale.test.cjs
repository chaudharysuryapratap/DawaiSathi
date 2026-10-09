/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
function harness() {
  const state=[], effects=[], calls=[]; let cursor=0, listener, cleanup;
  class Value { constructor(value){this.value=value;} stopAnimation(){} setValue(value){this.value=value;} }
  const mocks={
    react:{__esModule:true,default:{},forwardRef:fn=>fn,useRef(initial){const i=cursor++;state[i]??={current:initial};return state[i];},useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=value;}];},useEffect(fn){effects.push(fn);}},
    'react-native':{Pressable:'button',Animated:{Value,createAnimatedComponent:()=> 'animated-button',timing:(value,options)=>({start(){calls.push(['timing',options]);value.value=options.toValue;}}),spring:(value,options)=>({start(){calls.push(['spring',options]);value.value=options.toValue;}})},StyleSheet:{flatten:style=>Object.assign({},...(Array.isArray(style)?style:[style]).filter(Boolean))},AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:(_,fn)=>{listener=fn;return{remove(){calls.push(['remove']);}};}}}
  };
  const filename=path.resolve(__dirname,'../src/components/ui/PressableScale.tsx'),loaded=new Module(filename,module);
  const feedback=[];
  mocks['@/src/utils/haptics']={lightPress:()=>feedback.push('light')};
  loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  return {calls,feedback,render(props){cursor=0;effects.length=0;return loaded.exports.default(props, 'ref');},async mount(){cleanup=effects[0]();await Promise.resolve();},motion:value=>listener(value),unmount:()=>cleanup()};
}
test('preserves original host layout, props, transforms, functional styles and callbacks',async()=>{
  const h=harness(),events=[],children=state=>String(state.pressed);
  const props={testID:'save',accessibilityLabel:'Save',hitSlop:9,onPress:()=>events.push('press'),onPressIn:()=>events.push('in'),onPressOut:()=>events.push('out'),children,style:({pressed})=>({padding:12,flex:1,opacity:pressed?.8:1,transform:[{rotate:'5deg'}]})};
  let node=h.render(props);await h.mount();
  assert.equal(node.type,'animated-button');assert.equal(node.props.children,children);assert.equal(node.props.testID,'save');assert.equal(node.props.hitSlop,9);
  node.props.onPressIn({});node=h.render(props);
  assert.equal(node.props.style[0].padding,12);assert.equal(node.props.style[0].flex,1);assert.equal(node.props.style[0].opacity,.8);
  assert.deepEqual(node.props.style[1].transform[0],{rotate:'5deg'});
  assert.equal(h.calls[0][1].duration,120);assert.equal(h.calls[0][1].toValue,.94);
  node.props.onPressOut({});node.props.onPress();assert.deepEqual(events,['in','out','press']);assert.equal(h.calls[1][0],'spring');
});
test('live Reduce Motion resets scale and disables animation; disabled buttons do not shrink',async()=>{
  const h=harness();let node=h.render({scaleTo:.88});await h.mount();node.props.onPressIn({});
  const scale=node.props.style[1].transform[0].scale;assert.equal(scale.value,.88);
  h.motion(true);assert.equal(scale.value,1);const count=h.calls.length;
  node.props.onPressIn({});node.props.onPressOut({});assert.equal(h.calls.length,count);
  h.motion(false);node=h.render({disabled:true});node.props.onPressIn({});assert.equal(h.calls.length,count);
  h.unmount();assert.equal(h.calls.at(-1)[0],'remove');
});
test('light feedback applies to regular buttons, not icons, cards, tabs or custom feedback actions',()=>{
  const h=harness();h.render({}).props.onPressIn({});assert.deepEqual(h.feedback,['light']);
  for(const props of [{scaleTo:.88},{scaleTo:.97},{accessibilityRole:'tab'},{haptic:false},{disabled:true}])h.render(props).props.onPressIn({});
  assert.deepEqual(h.feedback,['light']);
});
