import { format } from 'date-fns'
import { parseMessage } from './parseMessage.js'

export type EnvLogsData = {
  cs: number
  lvl?: 'error' | 'log'
  ts: number
  fn: string
  msg: string
}

export type AdminLogsData = {
  i: string // instance id/key
  eid: string
  lvl?: 'error' | 'log'
  ts: number
  mid: string // machine id
  url: string // ip/url
  srvc: string
  msg: string
}

const logLevelColor = (level: string): string => {
  switch (level) {
    case 'error': {
      return `<reset><b><red>[${level.toUpperCase()}]</red></b></reset>`
    }
    case 'info': {
      return `<reset><b><blue>[${level.toUpperCase()}]</blue></b></reset>`
    }
    default: {
      return `<reset><b><white>[${level.toUpperCase()}]</white></b></reset>`
    }
  }
}

const templateMessage = (
  timestamp: number,
  server: string,
  level: string,
  type: string,
  message: string,
): string => {
  const formatStr: string = 'dd/MM/yyyy | HH:mm'

  if (!message) {
    return ''
  }

  return (
    parseMessage(
      `<gray>${'─'.repeat(process.stdout.columns - 1)}</gray>\n` +
        `<gray>${format(timestamp, formatStr)}</gray> <b><magenta>[${server}]</magenta></b> ${logLevelColor(level)} <b><yellow>[${type}]</yellow></b>`,
    ) + `\n${message}`
  )
}

export const filterLogs = (
  data: EnvLogsData[] | AdminLogsData[],
  filters: {
    isCollapsed: boolean
    isApp: boolean
    isInfra: boolean
    byLevel: string
    byDateBefore: string
    byDateAfter: string
    byChecksum: number
    byFunctions: string | string[]
    byServices: string | string[]
  },
) => {
  const slice = process.stdout.columns - 5

  return data
    .map((log: any) => {
      log.msg = log.msg.replaceAll(
        '----------------------------------------------------',
        '',
      )

      if (filters.isCollapsed && log.msg.length > slice) {
        log.msg = log.msg?.slice(0, slice).trim() + '...'
      }

      return log
    })
    .filter((log) => log.msg && log.msg.length > 4)
}

export const formatLogs = (data: EnvLogsData[] | AdminLogsData[]) => {
  return data.map((log: EnvLogsData | AdminLogsData) => {
    if ('cs' in log) {
      const { lvl, ts, fn, msg } = log as EnvLogsData

      return templateMessage(ts, 'APP', lvl, `function: ${fn}`, msg)
    } else {
      const { lvl, ts, srvc, msg } = log as AdminLogsData

      return templateMessage(ts, 'INFRA', lvl, `service: ${srvc}`, msg)
    }
  })
}
