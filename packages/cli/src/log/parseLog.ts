import { hash } from '@saulx/hash'
import chalk from 'chalk'
import { Instance } from './findInstances'

export type LogData = {
  time: number
  log: string
  type: string
  id: string
}

export type LogLine = {
  text: string
  time: number
  color?: string
  type?: string
}

const colors = [
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
]

export const getRandomColor = (seed: string): string => {
  const hashed = hash(seed)
  const index = ((hashed % colors.length) + colors.length) % colors.length
  return colors[index]
}

export const parseLog = (
  logs: LogData[],
  instances: Instance[],
  columns: number
) => {
  const logLines: LogLine[] = []
  let previousLogItemIndex: number
  logs.forEach((logItem, logItemIndex) => {
    const instance = instances.find((instance) => instance.id === logItem.id)
    const color = getRandomColor(logItem.id)
    const instanceName = chalk[color](instance.name || instance.template)
    if (logItem.type === 'start') {
      logLines.push({
        color,
        text: instanceName + chalk.green(' [Service started]'),
        time: logItem.time,
        type: 'start',
      })
    } else if (logItem.type === 'update') {
      logLines.push({
        color,
        text:
          instanceName +
          chalk.blue(` [Service updated to ${logItem.log.slice(0, 8)}]`),
        time: logItem.time,
        type: 'update',
      })
    } else {
      const itemLines = logItem.log.split('\n')
      if (itemLines[itemLines.length - 1] === '') itemLines.pop()
      if (
        logItemIndex === 0 ||
        logItem.id !== logs[previousLogItemIndex]?.id ||
        logItem.time > logs[previousLogItemIndex]?.time + 1e3 // 1 second
      ) {
        logLines.push({
          color,
          time: logItem.time,
          text: instanceName,
          type: 'header',
        })
      }
      const textColor =
        logItem.type === 'error'
          ? 'red'
          : logItem.type === 'warning'
          ? 'yellow'
          : 'white'
      itemLines.forEach((itemLine) => {
        while (itemLine.length > columns - 2) {
          logLines.push({
            color,
            text: chalk[textColor](itemLine.substring(0, columns - 2)),
            time: logItem.time,
          })
          itemLine = itemLine.substring(columns - 2)
        }
        logLines.push({
          color,
          text: chalk[textColor](itemLine),
          time: logItem.time,
        })
      })
    }
    previousLogItemIndex = logItemIndex
  })
  return logLines
}
