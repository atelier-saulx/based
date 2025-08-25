export const toCsvHeader = (headers: string[]): string => {
  return headers.join(',') + '\n'
}

export const toCsvChunk = (rows: any[][]): string => {
  const dataRows = rows
    .map((row) => {
      const escapedRow = row.map((value) => {
        let stringValue = String(value)
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          stringValue = `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      return escapedRow.join(',')
    })
    .join('\n')

  return dataRows + '\n'
}
