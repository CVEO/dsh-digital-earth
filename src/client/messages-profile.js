/**
 * messages-profile.js — F5 profile v2 copy (drag endpoints, hover readout).
 *
 * Kept separate: src/client/messages.js is at 895/900 lines, so every new domain
 * gets its own module and messages.js only spreads it in.
 */
export const PROFILE_MESSAGES = {
  zh: {
    'profile.dragStart': '拖动起点，松开后按新端点重算剖面',
    'profile.dragEnd': '拖动终点，松开后按新端点重算剖面',
    'profile.recomputing': '正在按新端点重算剖面…',
    'profile.recomputeFailed': '重算剖面失败：{message}',
    'profile.hoverReadout': '{distance} · {height}',
    'profile.hoverEmpty': '{distance} · 无高程数据',
    'profile.hoverHint': '悬停图表或地面剖面线可读取该点高程',
  },
  en: {
    'profile.dragStart': 'Drag the start point; release to recompute the profile',
    'profile.dragEnd': 'Drag the end point; release to recompute the profile',
    'profile.recomputing': 'Recomputing the profile at the new endpoints…',
    'profile.recomputeFailed': 'Profile recompute failed: {message}',
    'profile.hoverReadout': '{distance} · {height}',
    'profile.hoverEmpty': '{distance} · no elevation',
    'profile.hoverHint': 'Hover the chart or the ground profile line to read its elevation',
  },
}
