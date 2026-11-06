/**
 * ui/hud.js — authored module of the Digital Earth client half.
 *
 * Motion-move target of the v1.x client.js monolith: the artifact is rebuilt with
 * `npm run build:client` and client.js is never edited by hand.
 */
import React from 'react'
import { HUD_SAMPLE_INTERVAL_MS, HUD_SETTLE_MS, formatCursor, sampleCursor } from '../cursor.js'
import { formatBytes, formatCount } from '../format.js'
import { t } from '../i18n.js'

const h = React.createElement

    /** Bottom-left HUD: FPS, pointer position/elevation, camera and per-layer statistics. */
    function StatusHud({ fps, stats, viewerRef, cesiumRef, labels, readoutRef }) {
      // The cursor readout is written straight into the DOM: it updates around five
      // times a second, so keeping it out of React avoids re-renders while busy.
      const cursorRef = React.useRef(null)

      React.useEffect(() => {
        const viewer = viewerRef.current
        const Cesium = cesiumRef.current
        if (!viewer || !Cesium) return undefined
        const canvas = viewer.scene.canvas
        const pointer = { x: 0, y: 0, inside: false, dirty: false, dragging: false }
        let settleTimer = 0
        let shown = null
        const paint = (value) => {
          if (value === shown) return
          shown = value
          if (cursorRef.current) cursorRef.current.textContent = value ?? t('hud.empty')
          if (readoutRef) readoutRef.current = value
        }
        const sampleInto = (allowPickPosition) => {
          let next = null
          if (pointer.inside) {
            const position = new Cesium.Cartesian2(pointer.x, pointer.y)
            const carto = sampleCursor(viewer, Cesium, position, { pickPosition: allowPickPosition === true })
            if (carto) next = formatCursor(Cesium, carto)
          }
          paint(next)
        }
        const clearSettle = () => {
          if (settleTimer) clearTimeout(settleTimer)
          settleTimer = 0
        }
        // One sample shortly after the pointer stops, allowed to read the depth
        // buffer: this is the only place the HUD pays for that GPU readback, and a
        // single read is enough because the camera is no longer moving.
        const armSettle = () => {
          clearSettle()
          settleTimer = setTimeout(() => {
            settleTimer = 0
            if (pointer.dragging) return
            pointer.dirty = false
            sampleInto(true)
          }, HUD_SETTLE_MS)
        }
        const onMove = (event) => {
          pointer.x = event.offsetX
          pointer.y = event.offsetY
          pointer.inside = true
          pointer.dirty = true
          // While the camera is being dragged the readout would be stale anyway;
          // skip sampling and let the pointer-up settle produce one update.
          if (!pointer.dragging) armSettle()
        }
        const onLeave = () => {
          pointer.inside = false
          pointer.dirty = true
          clearSettle()
        }
        const onPointerDown = () => {
          pointer.dragging = true
          clearSettle()
        }
        const onPointerUp = () => {
          if (!pointer.dragging) return
          pointer.dragging = false
          pointer.dirty = true
          armSettle()
        }
        canvas.addEventListener('pointermove', onMove, { passive: true })
        canvas.addEventListener('pointerleave', onLeave, { passive: true })
        canvas.addEventListener('pointerdown', onPointerDown, { passive: true })
        window.addEventListener('pointerup', onPointerUp, { passive: true })
        window.addEventListener('pointercancel', onPointerUp, { passive: true })
        // Steady cadence while the pointer moves: ray + terrain height only, so the
        // periodic path never touches the depth buffer and stays smooth on
        // multi-million-triangle tilesets.
        const timer = setInterval(() => {
          if (pointer.dragging || !pointer.dirty) return
          pointer.dirty = false
          sampleInto(false)
        }, HUD_SAMPLE_INTERVAL_MS)
        return () => {
          clearSettle()
          clearInterval(timer)
          canvas.removeEventListener('pointermove', onMove)
          canvas.removeEventListener('pointerleave', onLeave)
          canvas.removeEventListener('pointerdown', onPointerDown)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('pointercancel', onPointerUp)
          // Drop the stale readout so a later capture cannot reuse an old coordinate.
          if (readoutRef) readoutRef.current = null
        }
      }, [])

      return h(
        'div',
        { className: 'mv-hud mv-glass' },
        h(
          'div',
          { className: 'row mv-hud-primary' },
          // fps is null while the scene is idle (no render pass for 2 s); a dash is
          // honest, a 0 would suggest the scene renders nothing while idling.
          h('span', { className: 'mv-hud-fps', title: t('hud.fpsTitle') }, 'FPS ', h('b', null, fps === null ? '—' : fps)),
          h('span', { className: 'mv-hud-cursor' }, `${labels.pointer} `, h('b', { ref: cursorRef }, t('hud.empty'))),
          h('span', { className: 'mv-hud-camera' }, `${labels.camera} `, h('b', null, stats.height)),
          h('span', { className: 'mv-hud-heading' }, `${labels.heading} `, h('b', null, `${stats.heading} / ${stats.pitch}`)),
        ),
        stats.layers.map((row) =>
          h(
            'div',
            { key: row.id, className: 'row mv-hud-layer' },
            h('b', null, row.name),
            h('span', null, `${labels.tiles} `, h('b', null, formatCount(row.tiles))),
            h('span', null, `${labels.pending} `, h('b', null, formatCount(row.pending))),
            h('span', null, `${labels.triangles} `, h('b', null, formatCount(row.triangles))),
            h('span', null, `${labels.cache} `, h('b', null, formatBytes(row.memory))),
          ),
        ),
      )
    }

export { StatusHud }
