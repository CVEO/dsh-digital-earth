export function vectorError(message) {
  const error = new Error(message)
  const categories = [
    [/8 MB|过大/, 'size'], [/过多|数量异常/, 'count'], [/长度|越界|过短|尾部|首索引/, 'bounds'],
    [/经纬度|坐标/, 'coordinates'], [/几何|多边形|环/, 'geometry'], [/投影|WGS84/, 'projection'],
    [/配对|同名|多个/, 'pairing'], [/编码/, 'encoding'], [/不支持|unsupported/, 'unsupported'],
    [/没有可绘制|文件为空/, 'empty'],
  ]
  error.code = `vector.error.${categories.find(([pattern]) => pattern.test(message))?.[1] ?? 'invalid'}`
  return error
}

export function vectorErrorText(error, t) {
  return t(error?.code?.startsWith('vector.error.') ? error.code : 'vector.error.invalid')
}
