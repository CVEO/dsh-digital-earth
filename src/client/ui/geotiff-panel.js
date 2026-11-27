/**
 * ui/geotiff-panel.js — the "本地 GeoTIFF" route of the add-data dialog.
 *
 * Primary path is one file, not a folder: the page opens a file picker (or the
 * operator drops a .tif on the drop zone), streams the bytes to the host cache,
 * probes them and shows the preview. Publish is then one click. A folder route
 * stays available for very large files that should not be copied.
 *
 * The dialog itself stays a presenter: every host call lives in
 * `geotiff/flow.js`. This component is the visible states of publishing a raster
 * and always reports the *real* numbers the host gave it (bands, CRS, tiles).
 */
import React from 'react'

import { GlyphIcon } from './icons.js'
import { cancelJob, overlayFor, previewUrl, probeFile, scanFolder, startPublish, uploadGeotiff, waitForJob } from '../geotiff/flow.js'

const h = React.createElement

const fileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

const TIFF_NAME = /\.tiff?$/i

export function GeotiffRoute({ t, onPickFolder, onOverlayAdd, onClose, onBusyChange }) {
  const [dir, setDir] = React.useState('')
  const [files, setFiles] = React.useState([])
  const [truncated, setTruncated] = React.useState(false)
  const [jp2, setJp2] = React.useState(0)
  const [folderMode, setFolderMode] = React.useState(false)
  const [path, setPath] = React.useState('')
  const [picked, setPicked] = React.useState(null)
  const [probe, setProbe] = React.useState(null)
  const [preview, setPreview] = React.useState('')
  const [phase, setPhase] = React.useState('idle')
  const [uploadPct, setUploadPct] = React.useState(null)
  const [progress, setProgress] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const jobRef = React.useRef(null)
  const abortRef = React.useRef(null)
  const uploadAbortRef = React.useRef(null)
  const aliveRef = React.useRef(true)
  const inputRef = React.useRef(null)
  const busy = phase === 'publishing'
  const uploading = phase === 'uploading'

  React.useEffect(() => {
    onBusyChange?.(busy)
  }, [busy])

  React.useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      onBusyChange?.(false)
      abortRef.current?.abort()
      uploadAbortRef.current?.abort()
      const jobId = jobRef.current
      jobRef.current = null
      if (jobId) void cancelJob(jobId).catch(() => {})
    }
  }, [])

  const reasonText = (failure) => {
    const code = failure?.code ?? ''
    // `unsupported` means the Host predates the GeoTIFF routes: no file is bad,
    // the plugin simply needs a DSH restart after an update.
    if (code === 'unsupported') return t('geotiff.errHostStale')
    if (code === 'not_tiff' || code === 'bigtiff' || code === 'truncated' || code === 'corrupt' || code === 'unsupported_bits' || code === 'planar' || code === 'predictor') {
      return t('geotiff.errFormat')
    }
    if (code === 'compression') return t('geotiff.errCompression')
    if (code === 'too_large') return t('geotiff.errTooLarge')
    if (code === 'georef' || code === 'crs') return t('geotiff.errGeo')
    if (code === 'not_allowed' || code === 'unsafe_dir') return t('geotiff.errFolder')
    if (code === 'too_many_jobs') return t('geotiff.errBusy')
    return t('geotiff.errGeneric', { code: code || 'unknown' })
  }

  const fail = (stage, failure) => {
    const reason = reasonText(failure)
    const text =
      stage === 'scan'
        ? t('geotiff.errScan', { reason })
        : stage === 'upload'
          ? t('geotiff.errUpload', { reason })
          : stage === 'probe'
            ? t('geotiff.errProbe', { reason })
            : t('geotiff.errPublish', { reason })
    setError({ tone: 'danger', text })
  }

  const choose = async (item) => {
    setPath(item.path)
    setPicked(item)
    setProbe(null)
    setPreview('')
    setError(null)
    setPhase('probing')
    try {
      const detail = await probeFile(item.path)
      if (!detail?.fileKey) throw new Error('missing detail')
      if (!aliveRef.current) return
      setProbe(detail)
      setPreview(await previewUrl(detail))
      setPhase('ready')
    } catch (failure) {
      if (!aliveRef.current) return
      fail('probe', failure)
      setPhase('idle')
      setPath('')
    }
  }

  const acceptFile = async (file) => {
    if (!file) return
    if (!TIFF_NAME.test(file.name)) {
      setError({ tone: 'danger', text: t('geotiff.errFormat') })
      return
    }
    setError(null)
    setProbe(null)
    setPreview('')
    setPath('')
    setPicked({ name: file.name, size: file.size })
    setUploadPct(0)
    setPhase('uploading')
    const controller = new AbortController()
    uploadAbortRef.current = controller
    try {
      const uploaded = await uploadGeotiff(file, {
        signal: controller.signal,
        onProgress: (loaded, total) => {
          if (aliveRef.current) setUploadPct(total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null)
        },
      })
      if (!aliveRef.current) return
      await choose(uploaded)
    } catch (failure) {
      if (!aliveRef.current) return
      if (failure?.code === 'canceled') {
        setPhase('idle')
        return
      }
      fail('upload', failure)
      setPhase('idle')
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null
    }
  }

  const scan = async () => {
    if (!onPickFolder) {
      setError({ tone: 'danger', text: t('geotiff.pickerUnavailable') })
      return
    }
    setError(null)
    setPhase('scanning')
    try {
      const pickedDir = await onPickFolder()
      const folder = typeof pickedDir === 'string' ? pickedDir : pickedDir?.dir
      if (!folder) {
        setPhase('idle')
        return
      }
      setDir(folder)
      setFiles([])
      setProbe(null)
      setPreview('')
      setPath('')
      const result = await scanFolder(folder)
      setFiles(Array.isArray(result.files) ? result.files : [])
      setTruncated(result.truncated === true)
      setJp2(Number(result.jp2) || 0)
      setPhase('idle')
    } catch (failure) {
      fail('scan', failure)
      setPhase('idle')
    }
  }

  const publish = async () => {
    if (!probe) return
    setConfirmCancel(false)
    setError(null)
    setPhase('publishing')
    setProgress({ done: 0, total: probe.pyramid?.total ?? 0, level: 0, maxLevel: probe.pyramid?.maxLevel ?? 0 })
    abortRef.current = new AbortController()
    try {
      const started = await startPublish(probe.path, probe.render)
      jobRef.current = started.jobId
      const job = await waitForJob(started.jobId, {
        signal: abortRef.current.signal,
        onProgress: (status) => {
          if (aliveRef.current) setProgress(status)
        },
      })
      jobRef.current = null
      if (!aliveRef.current) return
      const overlay = await overlayFor(probe, job)
      onOverlayAdd?.(overlay)
      setPhase('done')
    } catch (failure) {
      jobRef.current = null
      if (!aliveRef.current) return
      if (failure?.code === 'canceled') {
        setError({ tone: 'note', text: t('geotiff.canceled') })
        setPhase('ready')
        return
      }
      fail('publish', failure)
      setPhase('ready')
    }
  }

  // Canceling is destructive to the current session (finished levels survive),
  // so it takes two deliberate clicks; the label flips instead of opening a
  // second modal on top of the dialog.
  const cancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    setConfirmCancel(false)
    const jobId = jobRef.current
    jobRef.current = null
    abortRef.current?.abort()
    if (jobId) void cancelJob(jobId).catch(() => {})
    setPhase('ready')
    setError({ tone: 'note', text: t('geotiff.canceled') })
  }

  if (phase === 'done') {
    return h(
      'div',
      { className: 'mv-geo-done' },
      h('b', null, t('geotiff.doneTitle')),
      h('p', { className: 'mv-note' }, t('geotiff.doneHint')),
      h(
        'div',
        { className: 'mv-geo-actions' },
        h('button', { type: 'button', className: 'mv-cta primary', onClick: () => onClose?.() }, t('geotiff.close')),
      ),
    )
  }

  const uploadBar = () =>
    uploading
      ? h(
          'div',
          { className: 'mv-geo-progress' },
          h('span', null, t('geotiff.uploading', { percent: uploadPct ?? 0 })),
          h(
            'div',
            { className: 'mv-geo-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': uploadPct ?? 0 },
            h('i', { style: { width: `${uploadPct ?? 0}%` } }),
          ),
          h(
            'button',
            { type: 'button', className: 'mv-cta', onClick: () => uploadAbortRef.current?.abort() },
            t('geotiff.cancelUpload'),
          ),
        )
      : null

  const pickedBox = () =>
    h(
      'div',
      { className: 'mv-geo-picked' },
      h('span', { className: 'mv-geo-picked-icon', 'aria-hidden': true }, h(GlyphIcon, { name: 'raster', size: 16 })),
      h('span', { className: 'ellipsis', title: path || picked.name }, picked.name),
      h('span', { className: 'mv-geo-size' }, fileSize(picked.size)),
      busy
        ? null
        : h(
            'button',
            { type: 'button', className: 'mv-cta', onClick: () => inputRef.current?.click() },
            t('geotiff.changeFile'),
          ),
    )

  // Kept mounted across the dropzone/chip swap: a change-file button needs the
  // same DOM input to stay clickable after the first upload.
  const fileInput = () =>
    h('input', {
      ref: inputRef,
      type: 'file',
      accept: '.tif,.tiff,image/tiff',
      hidden: true,
      onChange: (event) => {
        void acceptFile(event.target.files?.[0])
        event.target.value = ''
      },
    })

  const fileBox = () =>
    picked
      ? h(React.Fragment, null, pickedBox(), uploadBar())
      : h(
          'div',
          { className: 'mv-geo-drop-wrap' },
          h(
            'button',
            {
              type: 'button',
              className: 'mv-geo-drop',
              disabled: uploading || busy,
              onClick: () => inputRef.current?.click(),
              onDragOver: (event) => event.preventDefault(),
              onDrop: (event) => {
                event.preventDefault()
                if (uploading || busy) return
                void acceptFile(event.dataTransfer?.files?.[0])
              },
            },
            h('span', { className: 'mv-geo-drop-icon', 'aria-hidden': true }, h(GlyphIcon, { name: 'raster', size: 22 })),
            h('b', null, t('geotiff.chooseFile')),
            h('em', null, t('geotiff.dropHint')),
            h('small', null, t('geotiff.fileSupport')),
          ),
        )

  const folderBox = () =>
    dir === ''
      ? h(
          'button',
          { type: 'button', className: 'mv-add-route', disabled: phase === 'scanning', onClick: () => void scan() },
          h(GlyphIcon, { name: 'folder', size: 18 }),
          h('span', null, h('b', null, phase === 'scanning' ? t('geotiff.scanning') : t('geotiff.pickFolder')), h('em', null, t('geotiff.folderHint'))),
        )
      : h(
          'button',
          {
            type: 'button',
            className: 'mv-geo-dir',
            title: dir,
            disabled: busy,
            onClick: () => void scan(),
          },
          h(GlyphIcon, { name: 'folder', size: 14 }),
          h('span', { className: 'ellipsis' }, dir),
          h('em', null, t('geotiff.browse')),
        )

  const fileList = () => {
    if (files.length === 0) {
      return dir === ''
        ? null
        : h(
            'div',
            { className: 'mv-geo-empty' },
            h('p', { className: 'mv-note' }, t('geotiff.empty')),
            h('button', { type: 'button', className: 'mv-cta', onClick: () => void scan() }, t('geotiff.changeFolder')),
          )
    }
    return h(
      'div',
      { className: 'mv-geo-list', role: 'listbox', 'aria-label': t('geotiff.tabLocal') },
      ...files.map((file) =>
        h(
          'button',
          {
            key: file.path,
            type: 'button',
            role: 'option',
            'aria-selected': file.path === path,
            className: `mv-geo-file${file.path === path ? ' on' : ''}`,
            title: file.path,
            disabled: busy || phase === 'probing',
            onClick: () => void choose(file),
          },
          h('span', { className: 'ellipsis' }, file.name),
          h('span', { className: 'mv-geo-size' }, t('geotiff.fileMeta', { size: fileSize(file.size) })),
        ),
      ),
    )
  }

  const specs = () => {
    if (probe === null) return null
    const crs = probe.crs?.name || t('geotiff.crsUnknown')
    return h(
      'div',
      { className: 'mv-geo-specs' },
      h('span', null, t('geotiff.specs', { w: probe.width, h: probe.height, bands: probe.bands, crs })),
      h('span', null, t('geotiff.gsd', { x: (probe.gsd?.x ?? 0).toFixed(2) })),
      h('span', null, t('geotiff.tiles', { n: probe.pyramid?.total ?? 0, level: probe.pyramid?.maxLevel ?? 0 })),
      probe.bbox
        ? h('span', null, t('geotiff.bbox', {
            west: probe.bbox.west.toFixed(3),
            east: probe.bbox.east.toFixed(3),
            south: probe.bbox.south.toFixed(3),
            north: probe.bbox.north.toFixed(3),
          }))
        : null,
      probe.pyramid?.capped ? h('span', { className: 'mv-geo-warn' }, t('geotiff.capped', { level: probe.pyramid.maxLevel })) : null,
    )
  }

  const progressBox = () => {
    if (phase !== 'publishing') return null
    const done = progress?.done ?? 0
    const total = Math.max(1, progress?.total ?? 0)
    return h(
      'div',
      { className: 'mv-geo-progress' },
      h(
        'div',
        { className: 'mv-geo-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
        h('i', { style: { width: `${Math.round((done / total) * 100)}%` } }),
      ),
      h('span', null, `${t('geotiff.publishing', { done, total })} · ${t('geotiff.level', { level: progress?.level ?? 0, max: progress?.maxLevel ?? 0 })}`),
      h(
        'button',
        { type: 'button', className: `mv-cta${confirmCancel ? ' danger' : ''}`, onClick: cancel },
        confirmCancel ? t('geotiff.confirmCancel') : t('geotiff.cancel'),
      ),
    )
  }

  return h(
    React.Fragment,
    null,
    fileInput(),
    fileBox(),
    h(
      'button',
      {
        type: 'button',
        className: 'mv-geo-switch',
        hidden: folderMode,
        disabled: uploading || busy,
        onClick: () => setFolderMode(true),
      },
      t('geotiff.folderMode'),
    ),
    folderMode
      ? h(
          React.Fragment,
          null,
          folderBox(),
          jp2 > 0 ? h('p', { className: 'mv-note mv-geo-warn' }, t('geotiff.jp2', { n: jp2 })) : null,
          truncated ? h('p', { className: 'mv-note' }, t('geotiff.truncated')) : null,
          fileList(),
          h('button', { type: 'button', className: 'mv-geo-switch', onClick: () => setFolderMode(false) }, t('geotiff.fileMode')),
        )
      : null,
    phase === 'probing' ? h('p', { className: 'mv-note' }, t('geotiff.probing')) : null,
    preview
      ? h(
          'div',
          { className: 'mv-geo-preview-wrap' },
          h('img', { className: 'mv-geo-preview', src: preview, alt: t('geotiff.previewAlt') }),
          h('span', { className: 'mv-geo-preview-tag' }, t('geotiff.previewTag')),
        )
      : null,
    specs(),
    progressBox(),
    error ? h('p', { className: `mv-note ${error.tone === 'note' ? 'mv-geo-note' : 'mv-danger'}` }, error.text) : null,
    probe && !busy
      ? h(
          'div',
          { className: 'mv-geo-actions' },
          h('button', { type: 'button', className: 'mv-cta primary', onClick: () => void publish() }, t('geotiff.publish')),
        )
      : null,
  )
}
