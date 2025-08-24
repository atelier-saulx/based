import { langCodesMap } from '../lang.js'
import { SchemaTypeDef, TEXT } from './types.js'

export function makeSeparateTextSort(result: Partial<SchemaTypeDef>) {
  result.hasSeperateTextSort = true
  let max = 0
  for (const f of result.separate) {
    if (f.typeIndex === TEXT) {
      if (f.prop > max) {
        max = f.prop
      }
    }
  }

  const bufLen = (max + 1) * (result.localeSize + 1)
  result.separateTextSort.buffer = new Uint8Array(bufLen)
  let index = 0
  for (const code in result.locales) {
    const codeLang = langCodesMap.get(code)
    result.separateTextSort.localeStringToIndex.set(
      code,
      new Uint8Array([index + 1, codeLang]),
    )
    result.separateTextSort.localeToIndex.set(codeLang, index + 1)
    index++
  }
  for (const f of result.separate) {
    if (f.typeIndex === TEXT) {
      const index = f.prop * (result.localeSize + 1)
      result.separateTextSort.buffer[index] = result.localeSize
      for (const [, locales] of result.separateTextSort.localeStringToIndex) {
        result.separateTextSort.buffer[locales[0] + index] = locales[1]
      }
      result.separateTextSort.props.push(f)
      result.separateTextSort.size += result.localeSize
    }
  }
  result.separateTextSort.props.sort((a, b) => (a.prop > b.prop ? 1 : -1))
  result.separateTextSort.bufferTmp = new Uint8Array(bufLen)
  result.separateTextSort.bufferTmp.fill(0)
  result.separateTextSort.bufferTmp.set(result.separateTextSort.buffer)
}
