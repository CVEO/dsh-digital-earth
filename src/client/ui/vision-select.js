import React from 'react'
import { captureVisionFrame, projectVisionPolygon } from '../scene/vision-frame.js'
import { visionRequest } from '../scene/vision-request.js'

const h = React.createElement

const VISION_TIMEOUT_MS = 65000

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

const emptyDraft = () => ({
  mode: 'dsh-default',
  allowUnverifiedModalities: true,
  dshModel: { provider: '', model: '' },
  openaiCompat: { baseUrl: '', apiKey: '', model: '', coordSpace: 'auto', maxTokens: 4096, hasApiKey: false, apiKeyHint: '' },
})

/**
 * AI-assisted target selection. Recognition never starts on mount: the dialog
 * first explains the cost and waits for an explicit "start" click, then the
 * running request can be stopped without closing the dialog. Supports
 * standalone vision model/endpoint configuration, collapsible diagnostics,
 * force-try for undeclared third-party models, and interactive vertex refinement.
 */
export function VisionSelect({ controller, anchor, t, onClose, onCommit, onManual }) {
  const [state, setState] = React.useState({ phase: 'ready', frame: null, result: null, error: '', diagnostic: null })
  const [attempt, setAttempt] = React.useState(0)
  const [forceRun, setForceRun] = React.useState(false)
  const [configOpen, setConfigOpen] = React.useState(false)
  const [configBusy, setConfigBusy] = React.useState(false)
  const [configMsg, setConfigMsg] = React.useState('')
  const [draft, setDraft] = React.useState(emptyDraft)
  const frameRef = React.useRef(null)
  const dialogRef = React.useRef(null)
  const svgRef = React.useRef(null)
  const dragIndexRef = React.useRef(-1)
  const abortRef = React.useRef(null)
  const stoppedRef = React.useRef(false)

  React.useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus?.() }
  }, [])

  React.useEffect(() => {
    if (attempt === 0) return undefined
    const abort = new AbortController()
    abortRef.current = abort
    stoppedRef.current = false
    let frame, interval, current = true, timedOut = false, stale = false
    const timer = setTimeout(() => { timedOut = true; abort.abort() }, VISION_TIMEOUT_MS)
    setState({ phase: 'loading', frame: null, result: null, error: '', diagnostic: null })
    const run = async () => {
      try {
        const url = controller?.getMeta?.()?.visionUrl
        await visionRequest(url, { signal: abort.signal, ...(forceRun ? { force: true } : {}) })
        if (!current || abort.signal.aborted) return
        frame = captureVisionFrame({ viewer: controller.getViewer(), Cesium: controller.getCesium(), anchor, getLayers: controller.getLayers, getViewer: controller.getViewer })
        frameRef.current = frame
        setState({ phase: 'loading', frame, result: null, error: '', diagnostic: null })
        interval = setInterval(() => {
          if (frame.isValid()) return
          stale = true
          abort.abort()
          clearInterval(interval)
          clearTimeout(timer)
          frame.release()
          if (current) setState((previous) => ({ ...previous, phase: 'error', error: 'scene_changed', diagnostic: null }))
        }, 150)
        const result = await visionRequest(url, { frame, signal: abort.signal, ...(forceRun ? { force: true } : {}) })
        if (!current || stale || abort.signal.aborted) return
        clearTimeout(timer)
        setState({ phase: 'preview', frame, result, error: '', diagnostic: null })
      } catch (error) {
        frame?.release()
        clearInterval(interval)
        clearTimeout(timer)
        if (current && !stale) {
          setState((previous) => ({
            ...previous,
            phase: 'error',
            error: stoppedRef.current ? 'cancelled' : timedOut ? 'timeout' : error?.code ?? 'model_failed',
            diagnostic: stoppedRef.current || timedOut ? null : (error?.diagnostic ?? null),
          }))
        }
      } finally {
        if (abortRef.current === abort) abortRef.current = null
      }
    }
    void run()
    return () => {
      current = false
      abort.abort()
      clearTimeout(timer)
      clearInterval(interval)
      frame?.release()
      frameRef.current = null
    }
  }, [controller, anchor, attempt, forceRun])

  const start = (force = false) => {
    if (state.phase === 'loading') return
    stoppedRef.current = false
    setForceRun(Boolean(force))
    setState({ phase: 'loading', frame: null, result: null, error: '', diagnostic: null })
    setAttempt((value) => value + 1)
  }

  const stop = () => {
    stoppedRef.current = true
    abortRef.current?.abort()
    const frame = frameRef.current
    frameRef.current = null
    frame?.release()
    setState((previous) => ({ ...previous, phase: 'error', frame: null, result: null, error: 'cancelled', diagnostic: null }))
  }

  const toggleConfig = async () => {
    const nextOpen = !configOpen
    setConfigOpen(nextOpen)
    setConfigMsg('')
    if (!nextOpen) return
    const cfgUrl = controller?.getMeta?.()?.visionConfigUrl
    if (!cfgUrl || typeof globalThis.fetch !== 'function') return
    setConfigBusy(true)
    try {
      const resp = await globalThis.fetch(cfgUrl, { credentials: 'same-origin' })
      const data = await resp.json().catch(() => null)
      if (resp.ok && data?.config) {
        setDraft({
          ...emptyDraft(),
          ...data.config,
          dshModel: { ...emptyDraft().dshModel, ...(data.config.dshModel ?? {}) },
          openaiCompat: { ...emptyDraft().openaiCompat, ...(data.config.openaiCompat ?? {}), apiKey: '' },
        })
      }
    } catch { /* keep default draft */ } finally {
      setConfigBusy(false)
    }
  }

  const saveConfig = async () => {
    const cfgUrl = controller?.getMeta?.()?.visionConfigUrl
    if (!cfgUrl || typeof globalThis.fetch !== 'function') return
    setConfigBusy(true)
    setConfigMsg('')
    try {
      const resp = await globalThis.fetch(cfgUrl, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-dsh-panel': 'vision-config' },
        body: JSON.stringify(draft),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.ok) throw new Error('save failed')
      setDraft((prev) => ({
        ...prev,
        ...data.config,
        openaiCompat: { ...prev.openaiCompat, ...(data.config?.openaiCompat ?? {}), apiKey: '' },
      }))
      setConfigMsg(t('vision.configSaved'))
    } catch {
      setConfigMsg(t('vision.configSaveFailed'))
    } finally {
      setConfigBusy(false)
    }
  }

  const updateVertexAtPointer = (event) => {
    const index = dragIndexRef.current
    const svg = svgRef.current
    if (index < 0 || !svg) return
    const rect = svg.getBoundingClientRect?.()
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return
    const nx = Math.round(clamp01((event.clientX - rect.left) / rect.width) * 10000) / 10000
    const ny = Math.round(clamp01((event.clientY - rect.top) / rect.height) * 10000) / 10000
    setState((previous) => {
      const poly = previous.result?.polygon
      if (!Array.isArray(poly) || index >= poly.length) return previous
      const nextPoly = poly.map((pt, i) => (i === index ? [nx, ny] : pt))
      return { ...previous, error: '', result: { ...previous.result, polygon: nextPoly } }
    })
  }

  const startVertexDrag = (index, event) => {
    event.preventDefault?.()
    event.stopPropagation?.()
    dragIndexRef.current = index
    event.currentTarget?.setPointerCapture?.(event.pointerId)
  }

  const endVertexDrag = () => {
    dragIndexRef.current = -1
  }

  const accept = () => {
    try {
      const ground = projectVisionPolygon(frameRef.current, state.result)
      frameRef.current.release()
      onCommit(ground)
      onClose()
    } catch (error) {
      setState((previous) => ({ ...previous, error: error?.code ?? 'depth_unavailable' }))
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus() }
  }

  const errorKey = `vision.error.${state.error}`
  const errorText = state.error && (t(errorKey) === errorKey ? t('vision.error.model_failed') : t(errorKey))
  const statusText = state.phase === 'ready'
    ? t('vision.readyToStart')
    : state.phase === 'loading'
      ? t('vision.loading')
      : state.result?.shape === 'box'
        ? t('vision.boxReady')
        : t('vision.ready')

  const hasConfigUrl = Boolean(controller?.getMeta?.()?.visionConfigUrl)
  const canForce = state.phase === 'error' && state.diagnostic?.canForce === true && (state.error === 'model_not_visual' || state.error === 'model_unknown')
  const diagLines = state.diagnostic
    ? [
        state.diagnostic.stage ? t('vision.diagStage', { stage: state.diagnostic.stage }) : '',
        state.diagnostic.backend ? t('vision.diagBackend', { backend: state.diagnostic.backend }) : '',
        state.diagnostic.model ? t('vision.diagModel', { model: state.diagnostic.provider ? `${state.diagnostic.provider} / ${state.diagnostic.model}` : state.diagnostic.model }) : '',
        state.diagnostic.detail ? t('vision.diagDetail', { detail: state.diagnostic.detail }) : '',
      ].filter(Boolean)
    : []

  return h('div', { className: 'mv-vision-screen', onKeyDown },
    h('section', { className: 'mv-vision', role: 'dialog', 'aria-modal': true, 'aria-label': t('vision.title'), tabIndex: -1, ref: dialogRef },
      h('header', null,
        h('h3', null, t('vision.title')),
        h('div', { className: 'mv-vision-head-actions' },
          hasConfigUrl ? h('button', { type: 'button', className: 'mv-cta', onClick: toggleConfig }, t('vision.configToggle')) : null,
          h('button', { type: 'button', className: 'mv-icon-btn', 'aria-label': t('btn.close'), onClick: onClose }, '✕'),
        ),
      ),
      configOpen
        ? h('div', { className: 'mv-vision-cfg' },
            h('label', null, t('vision.configMode'),
              h('select', { value: draft.mode, onChange: (e) => setDraft((prev) => ({ ...prev, mode: e.target.value })) },
                h('option', { value: 'dsh-default' }, t('vision.configModeDefault')),
                h('option', { value: 'dsh-model' }, t('vision.configModeDsh')),
                h('option', { value: 'openai-compat' }, t('vision.configModeOpenai')),
              ),
            ),
            draft.mode === 'dsh-model'
              ? h('div', { className: 'mv-vision-cfg-row' },
                  h('label', null, t('vision.configProvider'),
                    h('input', { type: 'text', value: draft.dshModel.provider, placeholder: 'deepseek / custom', onChange: (e) => setDraft((p) => ({ ...p, dshModel: { ...p.dshModel, provider: e.target.value } })) }),
                  ),
                  h('label', null, t('vision.configModel'),
                    h('input', { type: 'text', value: draft.dshModel.model, placeholder: 'model-id', onChange: (e) => setDraft((p) => ({ ...p, dshModel: { ...p.dshModel, model: e.target.value } })) }),
                  ),
                )
              : null,
            draft.mode === 'openai-compat'
              ? h(React.Fragment, null,
                  h('label', null, t('vision.configBaseUrl'),
                    h('input', { type: 'url', value: draft.openaiCompat.baseUrl, placeholder: 'https://api.example.com/v1', onChange: (e) => setDraft((p) => ({ ...p, openaiCompat: { ...p.openaiCompat, baseUrl: e.target.value } })) }),
                  ),
                  h('div', { className: 'mv-vision-cfg-row' },
                    h('label', null, t('vision.configModel'),
                      h('input', { type: 'text', value: draft.openaiCompat.model, placeholder: 'mimo-v2-flash / deepseek-vl', onChange: (e) => setDraft((p) => ({ ...p, openaiCompat: { ...p.openaiCompat, model: e.target.value } })) }),
                    ),
                    h('label', null, t('vision.configCoordSpace'),
                      h('select', { value: draft.openaiCompat.coordSpace, onChange: (e) => setDraft((p) => ({ ...p, openaiCompat: { ...p.openaiCompat, coordSpace: e.target.value } })) },
                        h('option', { value: 'auto' }, t('vision.configCoordAuto')),
                        h('option', { value: 'unit' }, t('vision.configCoordUnit')),
                        h('option', { value: 'thousand' }, t('vision.configCoordThousand')),
                        h('option', { value: 'pixel' }, t('vision.configCoordPixel')),
                      ),
                    ),
                  ),
                  h('label', null, t('vision.configApiKey'),
                    h('input', { type: 'password', value: draft.openaiCompat.apiKey, placeholder: draft.openaiCompat.hasApiKey ? draft.openaiCompat.apiKeyHint : 'sk-...', onChange: (e) => setDraft((p) => ({ ...p, openaiCompat: { ...p.openaiCompat, apiKey: e.target.value } })) }),
                  ),
                )
              : null,
            h('div', { className: 'mv-vision-actions' },
              h('button', { type: 'button', className: 'mv-cta primary', disabled: configBusy, onClick: saveConfig }, t('vision.configSave')),
            ),
            configMsg ? h('p', { className: 'mv-vision-note' }, configMsg) : null,
          )
        : null,
      h('p', { className: 'mv-vision-note' }, t('vision.notice')),
      state.frame
        ? h('div', { className: 'mv-vision-image', style: { aspectRatio: `${state.frame.width}/${state.frame.height}` } },
            h('img', { src: state.frame.dataUrl, alt: t('vision.imageAlt'), draggable: false }),
            state.phase === 'loading'
              ? h('span', { className: 'mv-vision-busy-badge', 'aria-hidden': true },
                  h('span', { className: 'mv-vision-busy-dot' }),
                  t('vision.loadingBadge'),
                )
              : null,
            h('svg', {
              ref: svgRef,
              viewBox: '0 0 1000 1000',
              preserveAspectRatio: 'none',
              onPointerMove: updateVertexAtPointer,
              onPointerUp: endVertexDrag,
              onPointerCancel: endVertexDrag,
            },
              state.result ? h('polygon', { points: state.result.polygon.map(([lon, lat]) => `${lon * 1000},${lat * 1000}`).join(' '), vectorEffect: 'non-scaling-stroke' }) : null,
              h('circle', { cx: state.frame.point[0] * 1000, cy: state.frame.point[1] * 1000, r: 6, vectorEffect: 'non-scaling-stroke' }),
              ...(state.phase === 'preview' && Array.isArray(state.result?.polygon)
                ? state.result.polygon.map(([vx, vy], idx) =>
                    h('circle', {
                      key: `v-${idx}`,
                      className: 'mv-vision-handle',
                      cx: vx * 1000,
                      cy: vy * 1000,
                      r: 10,
                      vectorEffect: 'non-scaling-stroke',
                      onPointerDown: (event) => startVertexDrag(idx, event),
                    }),
                  )
                : []),
            ),
          )
        : null,
      h('p', { role: state.error ? 'alert' : 'status', 'aria-live': 'polite', className: state.error ? 'mv-vision-error' : 'mv-vision-status' },
        errorText || statusText),
      state.result?.repaired ? h('p', { className: 'mv-vision-note' }, t('vision.repairedNote')) : null,
      state.result?.model ? h('p', { className: 'mv-vision-note' }, t('vision.model', { model: state.result.model })) : null,
      diagLines.length > 0
        ? h('details', { className: 'mv-vision-diag' },
            h('summary', null, t('vision.diagSummary')),
            h('pre', null, diagLines.join('\n')),
          )
        : null,
      h('div', { className: 'mv-vision-actions' },
        state.phase === 'ready' ? h('button', { type: 'button', className: 'mv-cta primary', onClick: () => start(false) }, t('vision.start')) : null,
        state.phase === 'loading' ? h('button', { type: 'button', className: 'mv-cta', onClick: stop }, t('vision.stop')) : null,
        state.phase === 'preview' ? h('button', { type: 'button', className: 'mv-cta primary', disabled: Boolean(state.error), onClick: accept }, t('vision.accept')) : null,
        canForce ? h('button', { type: 'button', className: 'mv-cta primary', onClick: () => start(true) }, t('vision.forceTry')) : null,
        state.phase === 'error' ? h('button', { type: 'button', className: 'mv-cta primary', onClick: () => start(false) }, t('vision.retry')) : null,
        h('button', { type: 'button', className: 'mv-cta', onClick: () => { frameRef.current?.release(); onClose(); onManual() } }, t('vision.manual')),
        h('button', { type: 'button', className: 'mv-cta', onClick: onClose }, t('vision.cancel')))))
}
