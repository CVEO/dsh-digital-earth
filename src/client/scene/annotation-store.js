/**
 * scene/annotation-store.js — the candidate review queue of the extraction workbench (v1.9).
 *
 * The vision pipeline returns plain GeoJSON polygons. The review panel must be
 * able to accept / reject / rename / delete them and undo any of that inside the
 * session, while the export must see exactly the same records. This module owns
 * that state: plain data in, plain data out — no React, no DOM, no Cesium.
 *
 * Design rules:
 *   - every mutation replaces the whole feature list (immutable update) and pushes
 *     the previous list onto an undo stack capped at ANNOTATION_UNDO_LIMIT entries;
 *     redo is cleared on any new mutation;
 *   - `rev` counts content edits (`patch()` / `replaceGeometry()`) only, so
 *     approving a row never looks like a geometry/attribute edit to downstream QA;
 *   - `getState()`, `all()` and `accepted()` hand out deep copies, so the UI can
 *     never mutate the store behind the store's back;
 *   - geometry is carried through untouched: this module classifies and reviews,
 *     the export decides how to serialise a polygon.
 */

/** The three review states of one candidate, in lifecycle order. */
export const ANNOTATION_STATUSES = Object.freeze(['pending', 'accepted', 'rejected'])

/** How many mutations a session can undo (older snapshots are dropped). */
export const ANNOTATION_UNDO_LIMIT = 50

/** Properties `patch()` accepts; every other key is ignored on purpose. */
export const ANNOTATION_PATCHABLE_KEYS = Object.freeze([
  'name',
  'class',
  'class_key',
  'height_m',
  'height_source',
  'floors',
  // Clearing the measured base/roof keeps a hand-edited height from still
  // exporting the old surface geometry as if it were measured.
  'base_m',
  'roof_m',
  // Footprint area is derived data: replacing a coarse box with a refined outline
  // must be able to refresh it, and the panel never recomputes it from geometry.
  'area_m2',
])

/**
 * Refinement provenance written by `replaceGeometry()`. `outline_source` says which
 * outline the row now carries (`box` / `refined` / `manual`), `refine_state` how the
 * last attempt ended, and the remaining keys record the measured quality gates.
 * These stay out of `ANNOTATION_PATCHABLE_KEYS` on purpose: the review form must
 * not silently turn a `box` row into a `refined` one.
 */
export const ANNOTATION_REFINE_KEYS = Object.freeze([
  'outline_source',
  'outline_quality',
  // A successful refine changes the geometry family: a detection box becomes a
  // polygon. Without this key the export's box filter would drop the refined row.
  'shape',
  'refine_error',
  'refine_state',
  'refine_attempts',
  'refine_bbox_iou',
  'refine_area_ratio',
])

/** Keys `replaceGeometry()` may write: editable review fields plus refinement data. */
export const ANNOTATION_REPLACE_KEYS = Object.freeze([...ANNOTATION_PATCHABLE_KEYS, ...ANNOTATION_REFINE_KEYS])

/**
 * Candidate properties copied from the incoming feature. `hex` is carried too so
 * the panel dot colour matches the class vocabulary of the run that produced it.
 * The store-owned keys (`id`, `status`, `method`, `source`, `run_id`, `rev`) are
 * always rewritten by `addCandidates()`.
 */
export const ANNOTATION_CARRIED_KEYS = Object.freeze([
  'class',
  'class_key',
  'class_name',
  'color',
  'clippedAtTileEdge',
  // Provenance: which model label came back, and which source produced the row
  // (tiles3d / 2d / manual). Without these a 2D candidate looked like a 3D one.
  'class_raw',
  'source_kind',
  'shape',
  // Outline provenance from P1a/P1b: a `box` row is a coarse fallback, `refined` /
  // `manual` rows carry a reviewed outline; the export can mark the difference.
  'outline_source',
  'outline_quality',
  'confidence',
  'height_m',
  'height_source',
  'floors',
  'base_m',
  'roof_m',
  'area_m2',
  'name',
  'hex',
])

const STATUS_SET = new Set(ANNOTATION_STATUSES)

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

/** Deep copy of JSON-safe data; the store never holds functions or class instances. */
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

/** Accept a single id or a list; `undefined`/`null` become an empty list. */
function normalizeIds(ids) {
  if (typeof ids === 'string') return ids === '' ? [] : [ids]
  if (!Array.isArray(ids)) return []
  return ids.filter((id) => typeof id === 'string' && id !== '')
}

/**
 * Create one review queue.
 *
 * @param {object} [options]
 * @param {() => number} [options.now] clock injection (tests, deterministic runs)
 * @param {string} [options.idPrefix] candidate id prefix, ids read `${idPrefix}-01`
 * @returns {object} the store: state read/write, subscription, stats and export views
 */
export function createAnnotationStore({ now = Date.now, idPrefix = 'A' } = {}) {
  const clock = typeof now === 'function' ? now : Date.now
  const prefix = typeof idPrefix === 'string' && idPrefix !== '' ? idPrefix : 'A'

  const stamp = () => {
    const value = clock()
    return typeof value === 'number' && Number.isFinite(value) ? value : Date.now()
  }

  /** Immutable snapshot list; never mutated in place after a commit. */
  let features = []
  /** Candidate sequence; restarts at 1 with every run so a run numbers A-01… */
  let sequence = 0
  /** Metadata of the current run, or null before the first `startRun()`. */
  let run = null
  /** Timestamp of the current run (or store creation before the first run). */
  let createdAt = stamp()

  const undoStack = []
  const redoStack = []
  const listeners = new Set()

  function countsOf() {
    const out = { total: features.length, pending: 0, accepted: 0, rejected: 0 }
    for (const feature of features) {
      const status = feature.properties.status
      if (status === 'accepted') out.accepted += 1
      else if (status === 'rejected') out.rejected += 1
      else out.pending += 1
    }
    return out
  }

  function getState() {
    return {
      run_id: run === null ? null : run.run_id,
      created_at: createdAt,
      candidates: features.map((feature) => clone(feature)),
      counts: countsOf(),
    }
  }

  function notify() {
    if (listeners.size === 0) return
    const state = getState()
    for (const listener of [...listeners]) {
      // One broken subscriber must not break the store or the other subscribers.
      try {
        listener(state)
      } catch {
        /* ignore listener failures */
      }
    }
  }

  /** Subscribe to state changes; listeners run synchronously after every commit. */
  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {}
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  /** Record the current list as an undo step and adopt the next list. */
  function commit(label, next) {
    undoStack.push({ label, features })
    if (undoStack.length > ANNOTATION_UNDO_LIMIT) undoStack.shift()
    redoStack.length = 0
    features = next
    notify()
  }

  function nextRunId() {
    return `R-${stamp()}`
  }

  /**
   * Start a fresh extraction run: new run metadata, empty queue, empty history.
   * `classes` is stored verbatim (deep copy) for the export notes.
   */
  function startRun({ mode = 'auto', source = '3d', scope = 'view', classes = [] } = {}) {
    createdAt = stamp()
    run = {
      run_id: nextRunId(),
      created_at: createdAt,
      mode: typeof mode === 'string' && mode !== '' ? mode : 'auto',
      source: typeof source === 'string' && source !== '' ? source : '3d',
      scope: typeof scope === 'string' && scope !== '' ? scope : 'view',
      classes: clone(Array.isArray(classes) ? classes : []),
    }
    features = []
    sequence = 0
    undoStack.length = 0
    redoStack.length = 0
    notify()
    return clone(run)
  }

  /**
   * Append candidates returned by one vision call (or several). Each feature gets
   * the store-owned properties; the carried class/height/area fields survive.
   * Entries that are not plain objects are ignored rather than throwing.
   *
   * @returns {string[]} ids of the appended candidates, in input order
   */
  function addCandidates(incoming) {
    const list = Array.isArray(incoming) ? incoming : []
    const next = features.slice()
    const added = []
    for (const raw of list) {
      if (!isObject(raw)) continue
      const input = clone(raw)
      const sourceProps = isObject(input.properties) ? input.properties : {}
      const properties = {}
      for (const key of ANNOTATION_CARRIED_KEYS) {
        if (!hasOwn(sourceProps, key)) continue
        const value = sourceProps[key]
        if (value === undefined) continue
        properties[key] = clone(value)
      }
      const taken = new Set(next.map((feature) => feature.properties.id))
      let id = ''
      do {
        sequence += 1
        id = `${prefix}-${String(sequence).padStart(2, '0')}`
      } while (taken.has(id))
      properties.id = id
      properties.status = 'pending'
      properties.method = typeof sourceProps.method === 'string' && sourceProps.method !== '' ? sourceProps.method : 'auto'
      // Extraction is a 2D orthophoto product now; never mislabel it as 3D.
      properties.source = typeof sourceProps.source === 'string' && sourceProps.source !== ''
        ? sourceProps.source
        : typeof sourceProps.source_kind === 'string' && sourceProps.source_kind !== '' ? sourceProps.source_kind : '3d'
      properties.run_id = run === null ? null : run.run_id
      properties.rev = 1
      next.push({
        type: 'Feature',
        geometry: input.geometry === undefined ? null : clone(input.geometry),
        properties,
      })
      added.push(id)
    }
    if (added.length > 0) commit(`add ${added.length}`, next)
    return added
  }

  /**
   * Adopt or reject candidates. Status flips leave `rev` alone.
   *
   * @returns {number} how many candidates actually changed status
   */
  function setStatus(ids, status) {
    if (typeof status !== 'string' || !STATUS_SET.has(status)) return 0
    const wanted = new Set(normalizeIds(ids))
    if (wanted.size === 0) return 0
    let changed = 0
    const next = features.map((feature) => {
      if (!wanted.has(feature.properties.id)) return feature
      if (feature.properties.status === status) return feature
      changed += 1
      return { ...feature, properties: { ...feature.properties, status } }
    })
    if (changed === 0) return 0
    commit(`${status} ${changed}`, next)
    return changed
  }

  /**
   * Edit one candidate. Only ANNOTATION_PATCHABLE_KEYS are applied, `undefined`
   * values are ignored (use null to clear), and a successful edit bumps `rev`.
   *
   * @returns {boolean} true when the candidate existed and at least one key applied
   */
  function patch(id, rawPatch) {
    if (typeof id !== 'string' || id === '' || !isObject(rawPatch)) return false
    const index = features.findIndex((feature) => feature.properties.id === id)
    if (index < 0) return false
    const properties = { ...features[index].properties }
    let touched = false
    for (const key of ANNOTATION_PATCHABLE_KEYS) {
      if (!hasOwn(rawPatch, key)) continue
      if (rawPatch[key] === undefined) continue
      properties[key] = clone(rawPatch[key])
      touched = true
    }
    if (!touched) return false
    const rev = typeof properties.rev === 'number' && Number.isFinite(properties.rev) ? properties.rev : 0
    properties.rev = rev + 1
    const next = features.slice()
    next[index] = { ...features[index], properties }
    commit(`patch ${id}`, next)
    return true
  }

  /**
   * Replace candidate outlines in one batch — the P1b refine write path.
   *
   * `updates` is a list of `{ id, geometry?, properties? }`. Only existing ids are
   * touched; unknown ids and non-object entries are ignored (the refine runner may
   * race a deletion made in the panel). `geometry` is written only when it is a
   * plain object; `undefined`/`null` means "properties only", so a failed refine
   * keeps the coarse box. Properties are limited to `ANNOTATION_REPLACE_KEYS`, so
   * status, confidence, id, method/source and run bookkeeping can never be changed
   * through this path unless the key is whitelisted for explicit review edits.
   *
   * The whole batch is one content edit: exactly one commit (one undo step, one
   * notify), and every changed feature gets `rev + 1` — even when the same id is
   * listed twice, because the user sees one refinement action.
   *
   * @returns {number} how many existing candidates actually changed
   */
  function replaceGeometry(updates) {
    const list = Array.isArray(updates) ? updates : []
    if (list.length === 0) return 0
    // Merge per id first: one edit per feature, last value wins for duplicated ids.
    const wanted = new Map()
    for (const raw of list) {
      if (!isObject(raw)) continue
      if (typeof raw.id !== 'string' || raw.id === '') continue
      let update = wanted.get(raw.id)
      if (update === undefined) {
        update = { geometry: undefined, properties: {} }
        wanted.set(raw.id, update)
      }
      // A null geometry is a properties-only update: never clear the outline.
      if (isObject(raw.geometry)) update.geometry = clone(raw.geometry)
      if (!isObject(raw.properties)) continue
      for (const key of ANNOTATION_REPLACE_KEYS) {
        if (!hasOwn(raw.properties, key)) continue
        if (raw.properties[key] === undefined) continue
        update.properties[key] = clone(raw.properties[key])
      }
    }
    if (wanted.size === 0) return 0
    let changed = 0
    const next = features.map((feature) => {
      const update = wanted.get(feature.properties.id)
      if (update === undefined) return feature
      const hasGeometry = update.geometry !== undefined
      const propertyKeys = Object.keys(update.properties)
      if (!hasGeometry && propertyKeys.length === 0) return feature
      const properties = { ...feature.properties }
      for (const key of propertyKeys) properties[key] = update.properties[key]
      const rev = typeof properties.rev === 'number' && Number.isFinite(properties.rev) ? properties.rev : 0
      properties.rev = rev + 1
      changed += 1
      return hasGeometry ? { ...feature, geometry: update.geometry, properties } : { ...feature, properties }
    })
    if (changed === 0) return 0
    commit(`replace-geometry ${changed}`, next)
    return changed
  }

  /**
   * Restore a persisted queue (snapshot v2). Keeps ids/status/rev/geometry and
   * every JSON-safe property; invalid rows are skipped. History starts clean: a
   * restored session cannot undo work performed before the reload.
   */
  function hydrate(rawFeatures) {
    const list = Array.isArray(rawFeatures) ? rawFeatures.slice(0, 500) : []
    const next = []
    const seen = new Set()
    for (const raw of list) {
      if (!isObject(raw)) continue
      const properties = isObject(raw.properties) ? clone(raw.properties) : {}
      const geometry = isObject(raw.geometry) ? clone(raw.geometry) : null
      let id = typeof properties.id === 'string' && properties.id !== '' ? properties.id : ''
      if (id === '' || seen.has(id)) {
        let seq = next.length + 1
        while (seen.has(`P-${String(seq).padStart(2, '0')}`)) seq += 1
        id = `P-${String(seq).padStart(2, '0')}`
      }
      seen.add(id)
      properties.id = id
      properties.status = STATUS_SET.has(properties.status) ? properties.status : 'pending'
      properties.rev = typeof properties.rev === 'number' && Number.isFinite(properties.rev) ? properties.rev : 1
      properties.method = typeof properties.method === 'string' && properties.method !== '' ? properties.method : 'auto'
      properties.source = typeof properties.source === 'string' && properties.source !== '' ? properties.source : '3d'
      properties.run_id = typeof properties.run_id === 'string' ? properties.run_id : null
      next.push({ type: 'Feature', geometry, properties })
    }
    if (next.length === 0) return 0
    // Restored ids are real store ids: continue the sequence above them so an
    // assist/manual append after a refresh cannot generate a duplicate id.
    for (const feature of next) {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(feature.properties.id)
      if (match) sequence = Math.max(sequence, Number(match[1]) || 0)
    }
    features = next
    undoStack.length = 0
    redoStack.length = 0
    notify()
    return next.length
  }

  /** Drop candidates by id; unknown ids are ignored. @returns {number} removed count */
  function remove(ids) {
    const wanted = new Set(normalizeIds(ids))
    if (wanted.size === 0) return 0
    const next = features.filter((feature) => !wanted.has(feature.properties.id))
    const removed = features.length - next.length
    if (removed === 0) return 0
    commit(`remove ${removed}`, next)
    return removed
  }

  /** Undo the last mutation. `label` mirrors the action for the toast text. */
  function undo() {
    const entry = undoStack.pop()
    if (entry === undefined) return { ok: false, label: null }
    redoStack.push({ label: entry.label, features })
    features = entry.features
    notify()
    return { ok: true, label: entry.label }
  }

  /** Redo the last undone mutation. */
  function redo() {
    const entry = redoStack.pop()
    if (entry === undefined) return { ok: false, label: null }
    undoStack.push({ label: entry.label, features })
    if (undoStack.length > ANNOTATION_UNDO_LIMIT) undoStack.shift()
    features = entry.features
    notify()
    return { ok: true, label: entry.label }
  }

  /**
   * Queue totals grouped by class for the panel summary. `byClass` keeps the
   * first-seen order of the queue; `key` is `class_key` (falling back to the
   * label) and `label` is `properties.class` as the pipeline returned it.
   */
  function stats() {
    const out = { total: 0, pending: 0, accepted: 0, rejected: 0, byClass: [] }
    const groups = new Map()
    for (const feature of features) {
      const properties = feature.properties
      const status = properties.status
      out.total += 1
      if (status === 'accepted') out.accepted += 1
      else if (status === 'rejected') out.rejected += 1
      else out.pending += 1
      const label = typeof properties.class === 'string' && properties.class !== '' ? properties.class : ''
      const key =
        typeof properties.class_key === 'string' && properties.class_key !== ''
          ? properties.class_key
          : label !== ''
            ? label
            : 'other'
      let group = groups.get(key)
      if (group === undefined) {
        group = { key, label, count: 0, accepted: 0 }
        groups.set(key, group)
      } else if (group.label === '' && label !== '') {
        // First non-empty label wins; a blank row never erases a known class name.
        group.label = label
      }
      group.count += 1
      if (status === 'accepted') group.accepted += 1
    }
    out.byClass = [...groups.values()]
    return out
  }

  /** Accepted candidates as deep copies, in queue order. */
  function accepted() {
    return features
      .filter((feature) => feature.properties.status === 'accepted')
      .map((feature) => clone(feature))
  }

  /** Every candidate as a deep copy, in queue order. */
  function all() {
    return features.map((feature) => clone(feature))
  }

  /** Available undo/redo steps, so the workbench can disable the buttons honestly. */
  function history() {
    return { undo: undoStack.length, redo: redoStack.length }
  }

  return {
    getState,
    subscribe,
    startRun,
    addCandidates,
    setStatus,
    patch,
    replaceGeometry,
    remove,
    hydrate,
    undo,
    redo,
    history,
    stats,
    accepted,
    all,
  }
}
