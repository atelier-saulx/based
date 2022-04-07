import chalk from 'chalk'
import { LogLine } from './parseLog'

export const renderLogs = (logLines: LogLine[]) => {
  logLines.forEach((line: LogLine) => {
    let prefix: string
    if (line.color === 'debug') {
      prefix = chalk.gray('¦ ')
    } else {
      prefix = chalk[line.color]('┃ ')
    }
    if (['header', 'start', 'update'].includes(line.type)) {
      console.info(
        prefix +
          line.text +
          chalk.gray(` ${humanDate(line.time)} ${timeSince(line.time)} ago`)
      )
    } else {
      console.info(prefix + line.text)
    }
  })
}

const z = (v: number | string) => ('00' + v).slice(-2)

const humanDate = (date: number): string => {
  const d = new Date(date)
  return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`
}

// https://stackoverflow.com/a/3177838
const timeSince = (date: number): string => {
  const seconds = Math.floor((Date.now() - date) / 1000)
  let interval = seconds / 31536000

  if (interval > 1) {
    return Math.floor(interval) + 'years'
  }
  interval = seconds / 2592000
  if (interval > 1) {
    return Math.floor(interval) + 'months'
  }
  interval = seconds / 86400
  if (interval > 1) {
    return Math.floor(interval) + 'd'
  }
  interval = seconds / 3600
  if (interval > 1) {
    return Math.floor(interval) + 'h'
  }
  interval = seconds / 60
  if (interval > 1) {
    return Math.floor(interval) + 'm'
  }
  return Math.floor(seconds) + 's'
}
