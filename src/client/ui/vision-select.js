import React from 'react'
import { captureVisionFrame, projectVisionPolygon } from '../scene/vision-frame.js'
import { visionRequest } from '../scene/vision-request.js'

const h = React.createElement

export function VisionSelect({ controller, anchor, t, onClose, onCommit, onManual }) {
  const [state, setState] = React.useState({ phase: 'loading', frame: null, result: null, error: '' })
  const [attempt, setAttempt] = React.useState(0)
  const frameRef = React.useRef(null)
  const dialogRef = React.useRef(null)
  React.useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus?.() }
  }, [])
  React.useEffect(() => {
    const abort = new AbortController()
    let frame, interval, current = true, timedOut = false, stale = false
    const timer = setTimeout(() => { timedOut = true; abort.abort() }, 23000)
    setState({ phase: 'loading', frame: null, result: null, error: '' })
    const run = async () => {
      try {
        const url = controller?.getMeta?.()?.visionUrl
        await visionRequest(url, { signal: abort.signal })
        if (!current || abort.signal.aborted) return
        frame = captureVisionFrame({ viewer: controller.getViewer(), Cesium: controller.getCesium(), anchor, getLayers: controller.getLayers, getViewer: controller.getViewer })
        frameRef.current = frame
        setState({ phase: 'loading', frame, result: null, error: '' })
        interval = setInterval(() => {
          if (frame.isValid()) return
          stale = true
          abort.abort()
          clearInterval(interval)
          clearTimeout(timer)
          frame.release()
          if (current) setState((previous) => ({ ...previous, phase: 'error', error: 'scene_changed' }))
        }, 150)
        const result = await visionRequest(url, { frame, signal: abort.signal })
        if (!current || stale || abort.signal.aborted) return
        clearTimeout(timer)
        setState({ phase: 'preview', frame, result, error: '' })
      } catch (error) {
        frame?.release()
        clearInterval(interval)
        clearTimeout(timer)
        if (current && !stale) setState((previous) => ({ ...previous, phase: 'error', error: timedOut ? 'timeout' : error?.code ?? 'model_failed' }))
      }
    }
    void run()
    return () => { current = false; abort.abort(); clearTimeout(timer); clearInterval(interval); frame?.release(); frameRef.current = null }
  }, [controller, anchor, attempt])
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
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus() }
  }
  const errorKey = `vision.error.${state.error}`
  const errorText = state.error && (t(errorKey) === errorKey ? t('vision.error.model_failed') : t(errorKey))
  return h('div', { className: 'mv-vision-screen', onKeyDown },
    h('section', { className: 'mv-vision', role: 'dialog', 'aria-modal': true, 'aria-label': t('vision.title'), tabIndex: -1, ref: dialogRef },
      h('header', null, h('h3', null, t('vision.title')), h('button', { type: 'button', className: 'mv-icon-btn', 'aria-label': t('btn.close'), onClick: onClose }, '✕')),
      h('p', { className: 'mv-vision-note' }, t('vision.notice')),
      state.frame ? h('div', { className: 'mv-vision-image', style: { aspectRatio: `${state.frame.width}/${state.frame.height}` } },
        h('img', { src: state.frame.dataUrl, alt: t('vision.imageAlt'), draggable: false }),
        h('svg', { viewBox: '0 0 1000 1000', preserveAspectRatio: 'none', 'aria-hidden': true },
          state.result ? h('polygon', { points: state.result.polygon.map(([lon, lat]) => `${lon * 1000},${lat * 1000}`).join(' '), vectorEffect: 'non-scaling-stroke' }) : null,
          h('circle', { cx: state.frame.point[0] * 1000, cy: state.frame.point[1] * 1000, r: 6, vectorEffect: 'non-scaling-stroke' }))) : null,
      h('p', { role: state.error ? 'alert' : 'status', 'aria-live': 'polite', className: state.error ? 'mv-vision-error' : 'mv-vision-status' },
        errorText || t(state.phase === 'loading' ? 'vision.loading' : state.result?.shape === 'box' ? 'vision.boxReady' : 'vision.ready')),
      state.result?.model ? h('p', { className: 'mv-vision-note' }, t('vision.model', { model: state.result.model })) : null,
      h('div', { className: 'mv-vision-actions' },
        state.phase === 'preview' ? h('button', { type: 'button', className: 'mv-cta primary', disabled: Boolean(state.error), onClick: accept }, t('vision.accept')) : null,
        state.phase !== 'loading' ? h('button', { type: 'button', className: 'mv-cta', onClick: () => setAttempt((value) => value + 1) }, t('vision.retry')) : null,
        h('button', { type: 'button', className: 'mv-cta', onClick: () => { frameRef.current?.release(); onClose(); onManual() } }, t('vision.manual')),
        h('button', { type: 'button', className: 'mv-cta', onClick: onClose }, t('vision.cancel')))))
}
