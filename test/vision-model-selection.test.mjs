import test from 'node:test'
import { createInstanceCache } from '../src/host/vision/instance-cache.js'
import { streamVisionText } from '../src/host/vision/stream-util.js'
import assert from 'node:assert/strict'
import { effectiveVisionConfig, modelRouteKey, visionModelDirectory } from '../src/host/vision/model-selection.js'
import { normalizeVisionConfig } from '../src/host/vision/config.js'

test('inherit the requesting session next model; preserve explicit DSH and API selections', async () => {
  const sessions = {
    projections: async ({ sessionId }) => ({ values: { modelSelection: { next: { provider:'host', model:sessionId } } } }),
    modelCatalog: async () => ({ groups:[{id:'host',name:'Provider',models:[{id:'v'}]}] }),
  }
  const services = {sessionController:sessions,agentDefaultModel:{currentSelection:()=>({provider:'host',model:'default'})}}
  const get = name => services[name]
  const cfg = normalizeVisionConfig({})
  const a = await effectiveVisionConfig({},get,cfg,'a'), b = await effectiveVisionConfig({},get,cfg,'b')
  assert.equal(a.dshModel.model,'a')
  assert.notEqual(modelRouteKey(a),modelRouteKey(b))
  assert.equal((await effectiveVisionConfig({},get,cfg,null)).dshModel.model,'default')
  for(const mode of ['openai-compat','dsh-model']){
    const explicit={...cfg,mode}
    assert.equal(await effectiveVisionConfig({},get,explicit,'b'),explicit)
  }
  assert.deepEqual((await visionModelDirectory({},get))[0].models,[{id:'v',name:'v'}])
})

test('keep a saved API credential only on its configured endpoint', () => {
  const cfg = normalizeVisionConfig({openaiCompat:{baseUrl:'https://one.test/v1',apiKey:'test-key',model:'a'}})
  const next = baseUrl => normalizeVisionConfig({openaiCompat:{baseUrl,model:'b'}},cfg)
  assert.equal(next('https://one.test/v1/').openaiCompat.apiKey,'test-key')
  assert.equal(next('https://two.test/v1').openaiCompat.apiKey,'')
})

test('identical frames reuse only complete answers from the same model, session and prompt', () => {
  const cache = createInstanceCache(2), input={data:Buffer.from('image'),classes:[{id:1}],mode:'locate'}
  const key = (session='s', fields={}) => cache.key('route',session,{...input,...fields},{})
  cache.put(key(),{boxes:[],usage:{total_tokens:21}})
  assert.deepEqual(cache.get(key()),{boxes:[],usage:null,reused:true})
  assert.equal(cache.get(key('other')),null)
  assert.equal(cache.get(key('s',{namedLabels:true})),null)
  assert.equal(cache.get(key('s',{data:Buffer.from('different')})),null)
  const unfinished = key('s',{mode:'trace_batch'})
  cache.put(unfinished,{instances:[],retrySlots:[1]})
  assert.equal(cache.get(unfinished),null)
})

test('record an exact DSH usage event even when it arrives after finish', async () => {
  const usage=[]
  const llm={async *stream(){
    yield {type:'text-delta',index:0,text:'[]'}
    yield {type:'finish',reason:{kind:'stop'}}
    yield {type:'usage',usage:{totalTokens:42}}
  }}
  const answer=await streamVisionText({provider:'p',model:'m',llm},{system:'',messages:[],maxTokens:100,
    maxTextChars:128,maxTotalBytes:1024,signal:new AbortController().signal,onUsage:u=>usage.push(u)})
  assert.equal(answer,'[]')
  assert.deepEqual(usage,[{total_tokens:42}])
})
