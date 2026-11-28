import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGrounded } from '../src/host/vision/grounded-instances.js'
import { segmentInstances } from '../src/client/scene/instance-segment.js'
import { TRACE_ANGLE } from '../src/client/scene/instance-crops.js'
import { sameFootprint } from '../src/client/scene/instance-overlap.js'

const classes = [{id:7,key:'farmland',name:'农田',definition:'一块边界可见的农田。',color:'#facc15'}]
const polygon = [[180,220],[780,190],[850,780],[150,820]]
const reply = body => ({ok:true,json:async()=>({ok:true,...body})})

test('batch trace checks unique slots, handles explicit absence and retries missing rows',()=>{
  const parsed=parseGrounded(JSON.stringify({slots:[{slot:1,polygon:polygon.map(p=>p.map(n=>n/2))},{slot:2,polygon:null},{slot:3,polygon},{slot:3,polygon}]}),
    {mode:'trace_batch',slots:[7,7,7,7],classes})
  assert.deepEqual(parsed,{instances:[{slot:1,classId:7,polygon}],retrySlots:[3,4]})
})

async function run(fetchImpl,maxCalls=8, extras={}){
  const source={...extras,read:()=> 'crop',readSheet:()=> 'sheet',lonLat:(x,y)=>({lon:x/1000,lat:-y/1000})}
  return segmentInstances({classes,meta:{visionInstancesUrl:'/vision',visionGroundedInstances:true},maxCalls,fetchImpl,
    captureFrame:async()=>({width:256,height:256,source})})
}
const boxes=[{classId:7,box:[150,150,350,350]},{classId:7,box:[580,500,830,730]}]

test('new route locates, batches, maps each local polygon to its own crop, retries only the missing slot',async()=>{
  const modes=[]
  const result=await run(async(_url,options)=>{
    const body=JSON.parse(options.body)
    modes.push(body.mode)
    if(body.mode==='locate')return reply({boxes})
    if(body.mode==='trace_batch'){
      assert.equal(body.image,'sheet')
      assert.deepEqual(body.slots,[7,7])
      return reply({instances:[{slot:1,classId:7,polygon}],retrySlots:[2]})
    }
    return reply({instances:[{classId:7,polygon}]})
  })
  assert.deepEqual(modes,['locate','trace_batch','trace'])
  assert.equal(result.report.complete,true)
  assert.equal(result.collection.features.length,2)
  const x=result.collection.features.map(f=>f.geometry.coordinates[0][0][0])
  assert.ok(x[1]-x[0]>.09)
})

test('budget exhaustion and a crop-frame echo never insert proposal rectangles',async()=>{
  const onlyBoxes=await run(async()=>reply({boxes}),1)
  assert.equal(onlyBoxes.report.calls,1)
  assert.equal(onlyBoxes.report.complete,false)
  assert.equal(onlyBoxes.collection.features.length,0)
  const result=await run(async(_url,options)=>JSON.parse(options.body).mode==='locate'
    ? reply({boxes:[boxes[0]]})
    : reply({instances:[{classId:7,polygon:[[0,0],[1000,0],[1000,1000],[0,1000]]}]}))
  assert.equal(result.collection.features.length,0)
  assert.equal(result.report.failedWindows[0].reason,'invalid_instances')
})

test('a rectangular field is retained when a rotated view independently traces its tilted corners',async()=>{
  const square=[[200,200],[800,200],[800,800],[200,800]]
  const rotated=square.map(([x,y])=>[
    Math.round(500+(x-500)*Math.cos(TRACE_ANGLE)-(y-500)*Math.sin(TRACE_ANGLE)),
    Math.round(500+(x-500)*Math.sin(TRACE_ANGLE)+(y-500)*Math.cos(TRACE_ANGLE)),
  ])
  const log=[]
  const result=await run(async(_url,options)=>{
    const body=JSON.parse(options.body)
    log.push(body.image)
    if(body.mode==='locate') return reply({boxes:[boxes[0]]})
    return reply({instances:[{classId:7,polygon:body.image==='rotated'?rotated:square}]})
  },8,{readTurned:()=> 'rotated'})
  assert.deepEqual(log,['crop','crop','rotated'])
  assert.equal(result.report.complete,true)
  assert.equal(result.collection.features.length,1)
})

test('parallel diagonal parcels sharing a bounding box remain separate',()=>{
  const a={pixels:[[0,0],[2,0],[12,10],[10,10]],bbox:{top:0,bottom:10},areaPx:20,windowId:'a'}
  const b={pixels:[[3,0],[5,0],[15,10],[13,10]],bbox:a.bbox,areaPx:20,windowId:'b'}
  assert.equal(sameFootprint(a,b,.55),false)
  assert.equal(sameFootprint(a,{...a,windowId:'b'},.55),true)
})


test('a crowded mixed answer rechecks a sparse class before the call budget is spent', async () => {
  const inputs = []
  const many = Array.from({length:20}, (_,i) => ({classId:7, box:[10+i*40,100,32+i*40,130]}))
  many.push({classId:2,box:[50,300,120,430]})
  const result = await segmentInstances({
    classes: [...classes, {id:2,key:'water',name:'水体',definition:'塘埂内水面。',color:'#38bdf8'}],
    meta:{visionInstancesUrl:'/vision',visionGroundedInstances:true}, maxCalls:2,
    captureFrame:async()=>({width:256,height:256,source:{read:()=> 'crop',lonLat:(x,y)=>({lon:x/1000,lat:-y/1000})}}),
    fetchImpl:async(_url,opts)=>{
      const input=JSON.parse(opts.body)
      inputs.push(input)
      return reply({boxes:inputs.length===1 ? many : []})
    },
  })
  assert.deepEqual(inputs.map(item=>item.mode),['locate','locate'])
  assert.deepEqual(inputs[1].classes.map(item=>item.id),[2])
  assert.equal(result.report.calls,2)
  assert.equal(result.report.complete,false)
})

test('detail windows share the run budget and the first successful model route', async () => {
  const calls = []
  const result = await segmentInstances({
    classes, meta:{ visionInstancesUrl:'/vision', visionGroundedInstances:true },
    multiScale:true, namedLabels:true, maxCalls:3, sessionId:'qa-session',
    captureFrame:async()=>({width:256,height:256,source:{read:rect=>JSON.stringify(rect),lonLat:()=>null}}),
    fetchImpl:async(_url,{headers,body})=>{
      calls.push({headers,body:JSON.parse(body)})
      return reply({boxes:[],modelRoute:'bound-route',model:'visual'})
    },
  })
  assert.equal(calls.length,3)
  assert.equal(calls[0].headers['x-dsh-session'],'qa-session')
  assert.equal(calls[1].headers['x-dsh-model-route'],'bound-route')
  assert.equal(calls[0].body.namedLabels,true)
  assert.equal(JSON.parse(calls[1].body.image).width,160)
  assert.equal(result.report.modelUsed,'visual')
  assert.equal(result.report.complete,false)
  assert.equal(result.report.failedWindows.length,2)
})
