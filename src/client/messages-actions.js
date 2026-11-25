/**
 * messages-actions.js — destructive-action copy (scoped clears, confirmations).
 *
 * messages.js is at its 900-line budget, so Batch A's confirmation vocabulary
 * lives here and is merged into the base catalog. The wording contract: every
 * destructive entry states what is deleted, how much, and whether local imports
 * or hand-drawn annotations are included.
 */

export const ACTION_MESSAGES = {
  zh: {
    'confirm.clearVectorTitle': '清空绘制与量测？',
    'confirm.clearVectorMessage': '将删除 {drawn} 个标注要素与 {measured} 个量测点。',
    'confirm.clearVectorIncludesUser': '其中包含本地导入或手绘的标注；此操作不可撤销。',
    'confirm.clearVectorUndo': '此操作不可撤销。',
    'confirm.clearAll': '全部清空',
    'confirm.clearMeasureOnly': '仅清量测',
    'layers.clearVectorHint': '清空绘制与量测…',
    'toast.vectorCleared': '已清空绘制与量测',
    'toast.measureCleared': '已清空量测',
    'toast.sunReplacesAnalysis': '已结束上一次日照分析并切换到时间轴；其他分析结果保留。',
  },
  en: {
    'confirm.clearVectorTitle': 'Clear drawn features and measurements?',
    'confirm.clearVectorMessage': 'This removes {drawn} drawn feature(s) and {measured} measurement point(s).',
    'confirm.clearVectorIncludesUser': 'Local imports and hand-drawn annotations are included. This cannot be undone.',
    'confirm.clearVectorUndo': 'This cannot be undone.',
    'confirm.clearAll': 'Clear all',
    'confirm.clearMeasureOnly': 'Measurements only',
    'layers.clearVectorHint': 'Clear drawn features and measurements…',
    'toast.vectorCleared': 'Drawn features and measurements cleared',
    'toast.measureCleared': 'Measurements cleared',
    'toast.sunReplacesAnalysis': 'Closed the previous sunlight analysis and switched to the timeline; other results are kept.',
  },
}
