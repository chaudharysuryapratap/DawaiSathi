/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(taken=false){
  const states=[],calls=[];let cursor=0,failSync=false;const write=deferred();
  const dose={dose_id:'dose',medicine_id:'med',time:'08:00',logged_at:taken?'2026-10-09T08:00:00Z':null,log_id:taken?'original':null};
  const api={
    familyGroups:async()=>{calls.push('groups');return[{id:'group'}];},members:async()=>[{id:'member',is_primary:true}],medicines:async()=>[],protocols:async()=>[],checkups:async()=>[],attention:async()=>({items:[]}),
    today:async()=>{calls.push('today');return{doses:[dose],protocols:[]};},history:async()=>{calls.push('history');if(failSync)throw Error('sync offline');return[];},protocolHistory:async()=>[],missedDoseHistory:async()=>[],upcomingCheckup:async()=>null,
    logDose:()=>write.promise,undoDose:()=>write.promise,
  };
  const mocks={
    react:{createContext:()=>({Provider:'provider'}),useCallback:fn=>fn,useMemo:fn=>fn(),useEffect(){},useRef(initial){const i=cursor++;states[i]??={current:initial};return states[i];},useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}},
    './api':{api},'./utils/storage':{storage:{getItem:async(key,fallback)=>key.includes('Family')?'group':key.includes('Member')?'member':fallback,setItem:async()=>{}}},
  };
  const filename=path.resolve(__dirname,'../src/data-context.tsx'),loaded=new Module(filename,module);loaded.require=id=>mocks[id]||require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
  const render=()=>{cursor=0;return loaded.exports.DataProvider({children:null}).props.value;};
  await render().refresh();calls.length=0;
  return{render,calls,write,failSync:()=>{failSync=true;}};
}
test('mark taken stays optimistic and never starts a full-page refresh',async()=>{
  const app=await harness();const pending=app.render().logDose('med','08:00');
  assert.ok(app.render().todayDoses[0].logged_at);assert.equal(app.render().loading,false);
  app.write.resolve({id:'saved',logged_at:'2026-10-09T09:10:00Z'});await pending;await tick();
  assert.equal(app.render().todayDoses[0].log_id,'saved');assert.equal(app.render().loading,false);
  assert.ok(app.calls.includes('history'));assert.ok(!app.calls.includes('today'));assert.ok(!app.calls.includes('groups'));
});
test('undo stays on the page and secondary sync failure never rolls it back',async()=>{
  const app=await harness(true);app.failSync();const pending=app.render().undoDose('med','08:00');
  assert.equal(app.render().todayDoses[0].logged_at,null);assert.equal(app.render().loading,false);
  app.write.resolve({ok:true});await pending;await tick();
  assert.equal(app.render().todayDoses[0].logged_at,null);assert.equal(app.render().error,null);
  assert.equal(app.render().loading,false);assert.ok(!app.calls.includes('today'));
});
test('failed write rolls back just the dose and propagates an inline-action error',async()=>{
  const app=await harness();const pending=app.render().logDose('med','08:00');
  app.write.reject(Error('save offline'));await assert.rejects(pending,/save offline/);
  assert.equal(app.render().todayDoses[0].logged_at,null);assert.equal(app.render().loading,false);assert.equal(app.render().error,null);
});
test('a write completing after member switching cannot sync the previous member over the new one',async()=>{
  const app=await harness();const pending=app.render().logDose('med','08:00');
  app.render().setActiveMember('other-member');
  app.write.resolve({id:'saved',logged_at:'2026-10-09T09:10:00Z'});await pending;await tick();
  assert.equal(app.render().activeMemberId,'other-member');assert.deepEqual(app.calls,[]);
});
