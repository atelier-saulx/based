export const toCsvHeader = (headers: string[]): string => {
  return headers.join(',') + '\n'
}

export const toCsvChunk = (rows: any[][]): string => {
  let chunkString = ''
  const numRows = rows.length

  for (let i = 0; i < numRows; i++) {
    const row = rows[i]
    const numCols = row.length

    for (let j = 0; j < numCols; j++) {
      let stringValue = String(row[j])
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        stringValue = `"${stringValue.replace(/"/g, '""')}"`
      }
      chunkString += stringValue
      if (j < numCols - 1) {
        chunkString += ','
      }
    }
    chunkString += '\n'
  }

  return chunkString
}
