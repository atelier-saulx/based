import { ENUM, STRING, JSON as JSON2, TEXT, TypeIndex } from '@based/schema/def'
import { concatUint8Arr } from '@based/utils'

export const toCsvHeader = (headers: string[]): string => {
  return headers.join(',') + '\n'
}

export const toCsvChunk = (rows: any[][], propTypes: TypeIndex[]): string => {
  let chunkString = ''
  const numRows = rows.length

  for (let i = 0; i < numRows; i++) {
    const row = rows[i]
    const numCols = row.length

    for (let j = 0; j < numCols; j++) {
      const type = propTypes[j]
      if (type === ENUM || type === STRING) {
        chunkString += escapeCSVReservedChars(String(row[j]))
      } else if (type === JSON2 || type === TEXT) {
        chunkString += escapeCSVReservedChars(JSON.stringify(row[j]))
      } else {
        chunkString += row[j]
      }
      if (j < numCols - 1) {
        chunkString += ','
      }
    }
    chunkString += '\n'
  }

  return chunkString
}

const escapeCSVReservedChars = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    value = `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function escapeCSVReservedBytes(bytes) {
  const COMMA = 44
  const QUOTE = 34
  const NEWLINE = 10

  let needsQuoting = false
  let quoteCount = 0

  for (const byte of bytes) {
    if (byte === QUOTE) {
      needsQuoting = true
      quoteCount++
    } else if (byte === COMMA || byte === NEWLINE) {
      needsQuoting = true
    }
  }

  if (!needsQuoting) {
    return bytes
  }

  const finalSize = bytes.length + 2 + quoteCount
  const result = new Uint8Array(finalSize)
  let writeIndex = 0

  result[writeIndex++] = QUOTE

  for (const byte of bytes) {
    result[writeIndex++] = byte
    if (byte === QUOTE) {
      result[writeIndex++] = QUOTE
    }
  }

  result[writeIndex] = QUOTE

  return result
}
