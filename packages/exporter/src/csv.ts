export const toCsvString = (headers: string[], rows: any[][]): string => {
  const headerRow = headers.join(',') + '\n'
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

  return headerRow + dataRows
}
