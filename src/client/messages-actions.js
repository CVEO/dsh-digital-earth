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
    'toast.vectorCleared': '已清空绘制与量测',
    'toast.measureCleared': '已清空量测',
    'toast.sunReplacesAnalysis': '已结束上一次日照分析并切换到时间轴；其他分析结果保留。',
  },
  en: {
    'toast.vectorCleared': 'Drawn features and measurements cleared',
    'toast.measureCleared': 'Measurements cleared',
    'toast.sunReplacesAnalysis': 'Closed the previous sunlight analysis and switched to the timeline; other results are kept.',
  },
}
