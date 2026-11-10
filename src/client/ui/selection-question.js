import React from 'react'
import { selectionQuestionContext } from '../scene/selection-question.js'

const h = React.createElement

export function SelectionQuestion({ selection, t, onAskSelection, showToast }) {
  const [open, setOpen] = React.useState(true)
  const [question, setQuestion] = React.useState('')
  const [includeImage, setIncludeImage] = React.useState(Boolean(selection.frame?.image))
  const [status, setStatus] = React.useState('idle')
  const [error, setError] = React.useState('')
  const inputRef = React.useRef(null)
  const requestRef = React.useRef(null)
  const busyRef = React.useRef(false)
  const aliveRef = React.useRef(true)
  React.useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])
  React.useEffect(() => {
    if (open) {
      inputRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' })
    }
  }, [open])
  const edit = (value) => { setQuestion(value); setStatus('idle'); setError(''); requestRef.current = null }
  const submit = async (event) => {
    event?.preventDefault?.()
    if (busyRef.current || !question.trim() || typeof onAskSelection !== 'function') return
    busyRef.current = true
    setStatus('sending')
    setError('')
    requestRef.current ??= { question: question.trim(), selection, includeImage,
      requestId: globalThis.crypto?.randomUUID?.() ?? `question-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    try {
      const result = await onAskSelection(requestRef.current)
      if (aliveRef.current) {
        if (result?.accepted !== true) throw Object.assign(new Error('send_failed'), { code: 'send_failed' })
        setStatus('sent')
      }
    } catch (failure) {
      if (aliveRef.current) {
        setError(failure?.code ?? 'send_failed')
        setStatus('error')
      }
    } finally { busyRef.current = false }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${question.trim()}\n${JSON.stringify(selectionQuestionContext(selection))}`)
      showToast?.(t('question.copied'))
    } catch { showToast?.(t('selection.copyFailed')) }
  }
  if (!open) return h('button', { type: 'button', className: 'mv-cta primary', onClick: () => setOpen(true) }, t('question.open'))
  const sending = status === 'sending'
  const noContext = selection.kind === 'screen' && (!includeImage || !selection.frame?.image)
  return h('form', { className: 'mv-selection-question', onSubmit: submit, 'aria-label': t('question.title'), 'aria-busy': sending },
    h('div', { className: 'mv-question-head' }, h('strong', null, t('question.title')),
      h('button', { type: 'button', className: 'mv-icon-btn', disabled: sending, 'aria-label': t('question.close'), onClick: () => setOpen(false) }, '✕')),
    h('p', { className: 'mv-question-note' }, t('question.hint')),
    selection.frame?.image ? h('img', { className: 'mv-question-preview', src: selection.frame.image, alt: t('question.imageAlt') })
      : h('p', { className: 'mv-question-note' }, t(selection.kind === 'screen' ? 'question.error.screen_requires_image' : 'question.noImage')),
    h('label', { className: 'mv-question-label' }, t('question.label'),
      h('textarea', { ref: inputRef, value: question, rows: 3, maxLength: 1200, disabled: sending, placeholder: t('question.placeholder'),
        onChange: (event) => edit(event.target.value), onKeyDown: (event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent?.isComposing) void submit(event)
        } })),
    h('div', { className: 'mv-question-prompts' }, ...['describe', 'compare', 'next'].map((key) => h('button', {
      type: 'button', key, disabled: sending, onClick: () => { edit(t(`question.prompt.${key}`)); inputRef.current?.focus?.({ preventScroll: true }) },
    }, t(`question.quick.${key}`)))),
    selection.frame?.image ? h('label', { className: 'mv-question-image' },
      h('input', { type: 'checkbox', checked: includeImage, disabled: sending, onChange: (event) => { setIncludeImage(event.target.checked); requestRef.current = null; setStatus('idle'); setError('') } }), t('question.includeImage')) : null,
    h('div', { className: 'mv-question-actions' },
      h('button', { type: 'submit', className: 'mv-cta primary', disabled: sending || status === 'sent' || noContext || !question.trim() || typeof onAskSelection !== 'function' }, t(sending ? 'question.sending' : 'question.send')),
      h('button', { type: 'button', className: 'mv-cta', onClick: () => void copy() }, t('question.copy'))),
    status === 'sent' ? h('p', { className: 'mv-question-status', role: 'status' }, t('question.sent')) : null,
    error ? h('p', { className: 'mv-question-error', role: 'alert' }, t(`question.error.${error}`)) : null,
    noContext && selection.frame?.image ? h('p', { className: 'mv-question-note' }, t('question.error.screen_requires_image')) : null,
  )
}
