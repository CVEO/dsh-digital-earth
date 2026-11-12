/**
 * messages-annotations.js — F2 annotation strings (name / note / edit / export).
 *
 * Copy rules: an annotation is a human label on real geometry, so the card says
 * who wrote the text and never invents a place name. Numbers stay plain; the
 * "vision" provenance only appears for model-derived features.
 */

export const ANNOTATION_MESSAGES = {
  zh: {
    'annotation.name': '名称',
    'annotation.namePlaceholder': '例如：研究区、采样点、临时便道',
    'annotation.note': '备注',
    'annotation.notePlaceholder': '写一句说明，会随 GeoJSON 一起保存',
    'annotation.save': '保存',
    'annotation.delete': '删除',
    'annotation.export': '导出 GeoJSON',
    'annotation.editHint': '名称与备注只保存在这份标注里；删除只作用于当前要素。',
    'annotation.saved': '已更新标注',
    'annotation.deleted': '已删除标注',
    'annotation.exported': '已导出 {name}',
    'annotation.editFailed': '标注没有更新（{reason}）。可以重试，或关闭卡片后重新点选。',
    'annotation.kind.point': '点',
    'annotation.kind.line': '线',
    'annotation.kind.area': '面',
    'annotation.kind.note': '注记',
  },
  en: {
    'annotation.name': 'Name',
    'annotation.namePlaceholder': 'e.g. study area, sample point, temporary road',
    'annotation.note': 'Note',
    'annotation.notePlaceholder': 'One line of context, saved with the GeoJSON',
    'annotation.save': 'Save',
    'annotation.delete': 'Delete',
    'annotation.export': 'Export GeoJSON',
    'annotation.editHint': 'Name and note belong to this annotation; delete removes only the current feature.',
    'annotation.saved': 'Annotation updated',
    'annotation.deleted': 'Annotation deleted',
    'annotation.exported': 'Exported {name}',
    'annotation.editFailed': 'The annotation was not updated ({reason}). Retry, or close the card and pick again.',
    'annotation.kind.point': 'Point',
    'annotation.kind.line': 'Line',
    'annotation.kind.area': 'Area',
    'annotation.kind.note': 'Note',
  },
}
