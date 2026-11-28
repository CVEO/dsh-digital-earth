/**
 * v20 — DSH attachment API drift: saveImages (current host) must work as well as
 * the legacy singular saveImage. Guards the "visual model service unavailable"
 * failure caused by the plugin calling a service the host no longer exposes.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { createDshLlmBackend } = await import('../src/host/vision/backends/dsh-llm.js')

const CLASSES = [{ id: 1, name: '建筑', definition: '建筑物' }]

function makeStream(answer) {
  return async function* stream() {
    yield { type: 'text-delta', index: 0, text: answer }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

test('dsh-llm: 当前宿主 saveImages 数组接口可完成实例分割', async () => {
  let saved = 0
  const attachments = {
    imageLimits: { maxImageBytes: 10 * 1024 * 1024 },
    async saveImages(inputs) {
      saved += 1
      assert.equal(inputs.length, 1)
      assert.equal(inputs[0].mediaType, 'image/jpeg')
      return [{ attachmentId: 'sha256:test', mediaType: 'image/jpeg', bytes: 123, width: 640, height: 480 }]
    },
  }
  const llm = {
    resolveModelInfo: async () => ({ inputModalities: ['image'], reasoning: { efforts: [] } }),
    stream: makeStream('{"o":[[1,[[10,10],[200,10],[200,200],[10,200]]]]}'),
  }
  const ctx = {
    get(name, required) {
      if (!required && name === 'attachments') return attachments
      if (name === 'attachments') return attachments
      if (name === 'llm') return llm
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'vision' }) }
      return undefined
    },
  }
  const backend = createDshLlmBackend({ ctx, getService: (name) => ctx.get(name, false), config: { mode: 'dsh-default', allowUnverifiedModalities: true } })
  const result = await backend.extractInstances({
    data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    mediaType: 'image/jpeg',
    width: 640,
    height: 480,
    classes: CLASSES,
  }, new AbortController().signal)
  assert.equal(saved, 1)
  assert.equal(result.instances.length, 1)
  assert.equal(result.instances[0].classId, 1)
  assert.equal(result.finish, 'stop')
})

test('dsh-llm: 旧宿主 saveImage 单数接口仍兼容', async () => {
  let saved = 0
  const attachments = {
    async saveImage(input) {
      saved += 1
      return { attachmentId: 'sha256:old', mediaType: input.mediaType, bytes: 4, width: 640, height: 480 }
    },
  }
  const llm = {
    resolveModelInfo: async () => ({ inputModalities: ['image'], reasoning: { efforts: [] } }),
    stream: makeStream('{"o":[[1,[[0,0],[100,0],[100,100]]]]}'),
  }
  const ctx = {
    get(name) {
      if (name === 'attachments') return attachments
      if (name === 'llm') return llm
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'vision' }) }
      return undefined
    },
  }
  const backend = createDshLlmBackend({ ctx, getService: (name) => ctx.get(name, false), config: { mode: 'dsh-default' } })
  await backend.extractInstances({ data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mediaType: 'image/jpeg', width: 640, height: 480, classes: CLASSES }, new AbortController().signal)
  assert.equal(saved, 1)
})
