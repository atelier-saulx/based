const mem: { [key: string]: number } = {}
function getLastSunday(year: number, month: number) {
  const memKey = year + '-' + month
  if (mem[memKey]) {
    return mem[memKey]
  }
  let date = new Date(Date.UTC(year, month + 1, 0))
  while (date.getUTCDay() !== 0) {
    date.setUTCDate(date.getUTCDate() - 1)
  }
  return (mem[memKey] = date.getTime())
}

export const isWinterTimeInEurope = (date?: Date) => {
  const nDate = date ?? new Date()
  const ts = nDate.getTime()
  const year = nDate.getUTCFullYear()
  const month = nDate.getUTCMonth()

  if (month >= 3) {
    return ts >= getLastSunday(year, 9) && ts < getLastSunday(year + 1, 2)
  } else {
    return ts >= getLastSunday(year - 1, 9) && ts < getLastSunday(year, 2)
  }
}
