import { format, parse } from 'date-fns'
import { dateOnly } from '../shared/index.js'

export const contextParse: Based.Context.Parse = {
  date: (
    value: string | Date,
    formatIN: string | undefined = dateOnly,
    formatOUT: string = dateOnly,
  ) => {
    let date: Date = new Date()

    if (typeof value === 'string') {
      date = parse(value, formatIN, new Date())
      value = format(date, formatOUT)
    } else {
      value = format(value, formatOUT)
    }

    return {
      value,
      date,
      timestamp: date.getTime(),
    }
  },
}
