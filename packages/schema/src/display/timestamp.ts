export const basedSchemaDateFormats = [
  ,
  'date',
  'date-time',
  'date-time-text',
  'human',
  'time',
  'time-precise',
] as const
export type BasedSchemaDateFormat = (typeof basedSchemaDateFormats)[number]
export type DateFormat = BasedSchemaDateFormat // deprecated

const addZero = (d: number): string => {
  const s = d + ''
  if (s.length === 1) {
    return '0' + s
  }
  return s
}

export default (nr: number | string, format?: DateFormat): string | number => {
  if (!format) {
    return nr
  }

  if (typeof nr === 'number') {
    const thenDate = new Date(nr)
    if (format === 'date') {
      return (
        thenDate.getDate() +
        '/' +
        (thenDate.getMonth() + 1) +
        '/' +
        thenDate.getFullYear()
      )
    } else if (format === 'time') {
      return thenDate.getHours() + ':' + addZero(thenDate.getMinutes())
    } else if (format === 'time-precise') {
      return (
        thenDate.getHours() +
        ':' +
        addZero(thenDate.getMinutes()) +
        ':' +
        addZero(thenDate.getSeconds())
      )
    } else if (format === 'date-time-text') {
      return `${thenDate.toLocaleDateString('default', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}, ${thenDate.toLocaleTimeString()}`
    } else if (format === 'date-time') {
      return (
        thenDate.getHours() +
        ':' +
        addZero(thenDate.getMinutes()) +
        ' ' +
        thenDate.getDate() +
        '/' +
        (thenDate.getMonth() + 1) +
        '/' +
        thenDate.getFullYear()
      )
    } else if (format === 'human') {
      const nowDate = new Date()

      if (nowDate.getTime() > thenDate.getTime()) {
        var secondsSince = Math.floor(
          (nowDate.getTime() - thenDate.getTime()) / 1000
        )

        var interval = secondsSince / 31536000 // seconds in a year
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'years' : 'year'} ago`
        }
        interval = secondsSince / 2592000 // seconds in a month
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'months' : 'month'} ago`
        }
        interval = secondsSince / 86400 // seconds in a day
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'days' : 'day'} ago`
        }
        interval = secondsSince / 3600 // seconds in an hour
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'hours' : 'hour'} ago`
        }
        interval = secondsSince / 60 // seconds in a minute :)
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'minutes' : 'minute'} ago`
        }
        if (secondsSince > 10) {
          const x = Math.floor(secondsSince)
          return `${x} ${x > 1 ? 'seconds' : 'second'} ago`
        }
        return 'Now'
      } else {
        // in the future
        var secondsSince = Math.floor(
          (thenDate.getTime() - nowDate.getTime()) / 1000
        )

        var interval = secondsSince / 31536000 // seconds in a year
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'years' : 'year'} from now`
        }
        interval = secondsSince / 2592000 // seconds in a month
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'months' : 'month'} from now`
        }
        interval = secondsSince / 86400 // seconds in a day
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'days' : 'day'} from now`
        }
        interval = secondsSince / 3600 // seconds in an hour
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'hours' : 'hour'} from now`
        }
        interval = secondsSince / 60 // seconds in a minute :)
        if (interval > 1) {
          const x = Math.floor(interval)
          return `${x} ${x > 1 ? 'minutes' : 'minute'} from now`
        }
        if (secondsSince > 10) {
          const x = Math.floor(secondsSince)
          return `${x} ${x > 1 ? 'seconds' : 'second'} from now`
        }
        return 'Now'
      }
    }
    return String(nr)
  } else {
    return nr
  }
}
