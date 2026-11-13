/**
 * messages-export.js — F3 vector export strings (download / save / chat hand-off).
 *
 * Every failure names what the user can still do: download always works, save
 * needs the host route, send needs a live conversation. No string promises a
 * real attachment, because the chat client decides that, not this panel.
 */

export const EXPORT_MESSAGES = {
  zh: {
    'layers.exportVector': '导出 GeoJSON',
    'layers.vectorToChat': '发送到对话（附件）',
    'layers.vectorExportHint': '下载整层矢量叠加（标注 + 量测）为 GeoJSON 文件',
    'layers.vectorChatHint': '导出矢量 GeoJSON 并作为附件发送到当前对话',
    'vectorExport.empty': '矢量叠加层还没有内容：先导入数据或画一个标注。',
    'vectorExport.too_many_features': '一次最多导出 500 个要素，先删减或分批导出。',
    'vectorExport.too_many_coordinates': '坐标点超过 20000，先精简再导出。',
    'vectorExport.downloaded': '已下载 {count} 个要素的 GeoJSON。',
    'vectorExport.saved': '已写入 {count} 个要素：{path}',
    'vectorExport.sent': '已把 {count} 个要素的文件路径发送到对话。',
    'vectorExport.sentAttached': '已把 {count} 个要素的 GeoJSON 作为附件发送到对话。',
    'vectorExport.noSession': '当前没有打开的对话会话，无法发送；可以先下载或保存到导出目录。',
    'vectorExport.hostUnavailable': '宿主未提供导出目录接口，请改用下载。',
    'vectorExport.failed': '导出没有完成（{reason}），可以重试或改用下载。',
    'vectorExport.chatAttachNotice': '用户从三维地球面板把矢量叠加图层导出成 GeoJSON，文件已附在本消息，请以附件内容为准，不要另行推断。\n要素数：{count}\n范围（WGS84 经纬度）：{bbox}\n可直接读取附件；若需要复用几何，也可用 earth_draw 绘制同样的坐标。',
    'vectorExport.chatNotice': '用户从三维地球面板导出了一份矢量叠加数据，请以文件为准，不要另行推断内容。\n文件：{path}\n要素数：{count}\n范围（WGS84 经纬度）：{bbox}\n可用 earth_draw 读取该 GeoJSON 复用几何；若只需要说明，请按文件内容回答。',
    'vectorExport.name': '矢量叠加',
  },
  en: {
    'layers.exportVector': 'Export GeoJSON',
    'layers.vectorToChat': 'Send to chat (attach)',
    'layers.vectorExportHint': 'Download the whole vector overlay (annotations + measurements) as GeoJSON',
    'layers.vectorChatHint': 'Export vector GeoJSON and attach it to the live conversation',
    'vectorExport.empty': 'The vector overlay is empty: import data or draw an annotation first.',
    'vectorExport.too_many_features': 'At most 500 features can be exported at once; remove some or export in batches.',
    'vectorExport.too_many_coordinates': 'More than 20000 coordinates; simplify before exporting.',
    'vectorExport.downloaded': 'Downloaded a GeoJSON with {count} features.',
    'vectorExport.saved': 'Wrote {count} features to {path}',
    'vectorExport.sent': 'Sent the path of {count} features to the conversation.',
    'vectorExport.sentAttached': 'Attached a GeoJSON of {count} features to the conversation.',
    'vectorExport.noSession': 'No conversation is open, so the file cannot be sent; download it or save it to the exports folder instead.',
    'vectorExport.hostUnavailable': 'The host exposes no export folder; use Download instead.',
    'vectorExport.failed': 'The export did not finish ({reason}). Retry, or use Download.',
    'vectorExport.chatAttachNotice': 'The user exported the vector overlay layer from the digital earth panel and the GeoJSON is attached to this message; treat the attachment as the source of truth and do not infer extra content.\nFeatures: {count}\nBounds (WGS84 lon/lat): {bbox}\nRead the attachment directly; to reuse the geometry, earth_draw can draw the same coordinates.',
    'vectorExport.chatNotice': 'The user exported vector overlay data from the digital earth panel. Treat the file as the source of truth and do not infer extra content.\nFile: {path}\nFeatures: {count}\nBounds (WGS84 lon/lat): {bbox}\nYou may read the GeoJSON with earth_draw to reuse the geometry; if only explanation is needed, answer from the file.',
    'vectorExport.name': 'vector-overlay',
  },
}
