import { format } from 'date-fns'
import { parseMessage } from '../../../shared/parseMessage.js'
import { FilterArgs } from '../filter/index.js'

export type EnvLogsData = {
  cs: number
  lvl?: 'error' | 'info'
  ts: number
  fn: string
  msg: string
}

export type AdminLogsData = {
  i: string // instance id/key
  eid: string
  lvl?: 'error' | 'info'
  ts: number
  mid: string // machine id
  url: string // ip/url
  srvc: string
  msg: string
}

const logLevelColor = (level: string): string => {
  switch (level) {
    case 'error': {
      return `<b><red>[${level}]</red></b>`
    }
    case 'info': {
      return `<b><blue>[${level}]</blue></b>`
    }
    default: {
      return `<b><white>[${level}]</white></b>`
    }
  }
}

const templateMessage = (
  timestamp: number,
  labels: string[],
  message: string,
): string => {
  const formatStr: string = 'dd/MM/yyyy-HH:mm:ss:SSS'

  if (!message) {
    return ''
  }

  return (
    parseMessage(
      // `<gray>${'─'.repeat(process.stdout.columns - 1)}</gray>\n` +
      `<gray>${format(timestamp, formatStr)}</gray> ${labels.join(' ')}`,
    ) + `\n${message.trim()}\n`
  )
}

export const filterLogs = (
  data: EnvLogsData[] | AdminLogsData[],
  filters: FilterArgs,
) => {
  if (!data?.length) {
    return []
  }

  const sliceMessage: number = process.stdout.columns - 5

  if (!filters.stream) {
    data = data.slice(0, filters.limit)
  }

  return data
    .map((log: any) => {
      console.log(format(log.ts, 'dd/MM/yyyy'))
      if (
        (filters.level === 'info' && log.lvl === 'error') ||
        (filters.level === 'error' && log.lvl === 'info') ||
        (Array.isArray(filters.function) &&
          !filters.function.includes(log.fn)) ||
        (Array.isArray(filters.service) &&
          !filters.service.includes(log.srvc)) ||
        (filters.checksum && log.cs !== filters.checksum)
      ) {
        return false
      }

      // TODO remove this strange line from the logs in the cloud
      log.msg = log.msg.replaceAll(
        '----------------------------------------------------',
        '',
      )

      if (filters.collapsed && log.msg.length > sliceMessage) {
        log.msg = log.msg?.slice(0, sliceMessage) + '...'
      }

      return log
    })
    .filter((log) => (log.msg && log.msg.length > 4) || Boolean(log))
}

export const formatLogs = (data: EnvLogsData[] | AdminLogsData[]) => {
  return data.map((log: EnvLogsData | AdminLogsData) => {
    let labels: string[]

    if ('cs' in log) {
      const { lvl, ts, fn, cs, msg } = log as EnvLogsData

      labels = [
        '<b><magenta>[app]</magenta></b>',
        logLevelColor(lvl),
        `<yellow>[function: '<b>${fn}</b>']</yellow>`,
        `<blue>[checksum: '<b>${cs}</b>']</blue>`,
      ]

      return templateMessage(ts, labels, msg)
    } else {
      const { lvl, ts, srvc, mid, url, msg } = log as AdminLogsData

      labels = [
        '<b><magenta>[infra]</magenta></b>',
        logLevelColor(lvl),
        `<yellow>[service: '<b>${srvc}</b>']</yellow>`,
        `<green>[machineID: '<b>${mid}</b>']</green>`,
        `<blue>[IP: '<b>${url}</b>']</blue>`,
      ]

      return templateMessage(ts, labels, msg)
    }
  })
}
