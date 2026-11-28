import { createHash } from 'node:crypto'

// Only successful parsed answers are retained. Image bytes are hashed and discarded.
export function createInstanceCache(limit = 256, ttl = 15 * 60_000) {
  const entries = new Map()
  return {
    key(route, session, input, config) {
      const options = [route, session, input.mode, input.classes, input.slots, input.maxTokens,
        input.namedLabels, input.force, input.mediaType, config.allowUnverifiedModalities,
        config.openaiCompat?.coordSpace, config.openaiCompat?.maxTokens,
        config.mode === 'openai-compat' ? config.openaiCompat?.apiKey : null]
      return createHash('sha256').update(JSON.stringify(options)).update(input.data).digest('hex')
    },
    get(key) {
      const value = entries.get(key)
      if (!value) return null
      if (value.expires < Date.now()) { entries.delete(key); return null }
      entries.delete(key)
      entries.set(key, value)
      return { ...value.reply, usage:null, reused:true }
    },
    put(key, reply) {
      if (reply.retrySlots?.length) return
      entries.delete(key)
      entries.set(key, { reply, expires:Date.now()+ttl })
      if (entries.size > limit) entries.delete(entries.keys().next().value)
    },
  }
}
