/**
 * v1.5.2 availability regressions.
 *
 * The v1.5.1 panel acknowledged a `load` only after the camera flight resolved;
 * camera flights are driven by the render loop, so a hidden tab or a window in
 * the background left the command chain pending forever and every later tool
 * call timed out. These tests pin the three structural guarantees of the fix and
 * exercise the capture service's hidden-tab paths without a browser:
 *
 *   - `load` no longer awaits the flight and the command chain has a watchdog;
 *   - the Host budget for `load` covers direct + proxy fallback, and the client
 *     waits stay below the Host deadlines;
 *   - capture first tries to reveal the panel, then renders off-screen, and only
 *     fails when the canvas really has no drawable area.
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readRepoFile } from './helpers/source.mjs'
import { createCaptureService } from '../src/client/scene/capture.js'

const viewerSource = readRepoFile('src/client/viewer/ViewerSurface.js')
const captureSource = readRepoFile('src/client/scene/capture.js')
const sceneSource = readRepoFile('src/host/tools/scene.js')
const constantsSource = readRepoFile('src/host/constants.js')
const apiSource = readRepoFile('src/client/api.js')

test('load no longer waits for the camera flight, and the command chain has a watchdog', () => {
  assert.match(viewerSource, /void viewer\.flyTo\(tileset, \{ duration: 1\.2 \}\)\.catch\(\(\) => \{\}\)/)
  assert.doesNotMatch(viewerSource, /await viewer\.flyTo\(tileset/)
  // Per-command budgets: capture and report may legitimately run long, load gets
  // the full direct + proxy budget, everything else is short.
  assert.match(viewerSource, /commandBudgets = \{ capture: 40000, report: 45000, load: 40000 \}/)
  assert.match(viewerSource, /Promise\.race\(\[command, budget\]\)/)
  assert.match(viewerSource, /agent\.commandTimeout/)
})

test('panel readiness and authorisation waits stay below the Host deadlines', () => {
  assert.match(viewerSource, /waitForPanelReady = \(timeoutMs = 12000\)/)
  assert.match(apiSource, /ACCESS_TIMEOUT_MS = 28000/)
  assert.match(constantsSource, /LOAD_TIMEOUT_MS = 40000/)
  assert.match(constantsSource, /SCENE_TIMEOUT_MS = 20000/)
  assert.match(sceneSource, /request\.action === 'load'[\s\S]*?LOAD_TIMEOUT_MS/)
  // The path dialog and hidden captures both bring the panel forward first.
  assert.match(viewerSource, /revealPanel\(\)/)
})

test('authorisation dialogs and hidden captures ask the panel to come forward', () => {
  assert.match(captureSource, /const panelIsHidden = \(\) =>/)
  assert.match(captureSource, /typeof revealPanel === 'function'/)
  assert.match(captureSource, /revealPanel\(\)/)
  // A hidden tab skips the nextFrames wait but still performs the explicit render.
  assert.match(captureSource, /if \(!hidden\) \{/)
  assert.doesNotMatch(captureSource, /if \(hidden\) throw new Error\(t\('agent\.hiddenPanel'\)\)\n\s+const width/)
})

// ---------------------------------------------------------------------------
// Capture service behaviour with a fake document/viewer.
// ---------------------------------------------------------------------------

function fakeDocument(visibilityState = 'hidden') {
  return {
    visibilityState,
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage() {},
            fillText() {},
            measureText: () => ({ width: 10 }),
            beginPath() {},
            closePath() {},
            fill() {},
            stroke() {},
            fillRect() {},
            strokeRect() {},
            arcTo() {},
            moveTo() {},
            lineTo() {},
            save() {},
            restore() {},
            setLineDash() {},
          }
        },
        toDataURL: () => 'data:image/jpeg;base64,AAAA',
      }
    },
  }
}

function fakeViewer({ width = 900, height = 700 } = {}) {
  const canvas = { width, height }
  return {
    resolutionScale: 0.85,
    canvas,
    resize() {
      canvas.width = width
      canvas.height = height
    },
    render() {},
    scene: {},
  }
}

function serviceFor({ viewer, root, revealable = false }) {
  let reveals = 0
  const service = createCaptureService({
    getViewer: () => viewer,
    getRoot: () => root,
    getSettings: () => ({ settings: {} }),
    getMeta: () => null,
    getSession: () => 's',
    t: (key) => key,
    showToast: () => {},
    setChromeHidden: () => {},
    nextFrames: () => Promise.resolve(),
    revealPanel: () => {
      reveals += 1
      if (revealable) {
        root.offsetWidth = 900
        root.offsetHeight = 700
        globalThis.document.visibilityState = 'visible'
      }
      return true
    },
    drawCaptureOverlay: () => {},
    drawVectorLabels: () => {},
  })
  return { service, reveals: () => reveals }
}

const previousDocument = globalThis.document
after(() => {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
})

test('capture reveals a hidden panel and captures through the normal path', async () => {
  globalThis.document = fakeDocument('hidden')
  const root = { offsetWidth: 0, offsetHeight: 0 }
  const { service, reveals } = serviceFor({ viewer: fakeViewer(), root, revealable: true })
  const result = await service.renderSnapshot({ width: 800, format: 'jpeg' })
  assert.equal(reveals(), 1, 'capture must try to reveal the panel first')
  assert.ok(result.dataUrl.startsWith('data:image/'))
  assert.equal(result.width > 0, true)
})

test('capture falls back to an off-screen render when the tab stays hidden', async () => {
  globalThis.document = fakeDocument('hidden')
  const root = { offsetWidth: 0, offsetHeight: 0 }
  const { service, reveals } = serviceFor({ viewer: fakeViewer(), root })
  const result = await service.renderSnapshot({ width: 800, format: 'png' })
  assert.equal(reveals(), 1, 'the reveal attempt happened before the off-screen render')
  assert.ok(result.dataUrl.startsWith('data:image/'), 'a hidden tab with a live canvas still gets a picture')
})

test('capture still fails clearly when the canvas has no drawable area', async () => {
  globalThis.document = fakeDocument('hidden')
  const root = { offsetWidth: 0, offsetHeight: 0 }
  const { service } = serviceFor({ viewer: fakeViewer({ width: 0, height: 0 }), root })
  await assert.rejects(() => service.renderSnapshot({ width: 800 }), /agent\.hiddenPanel/)
})
