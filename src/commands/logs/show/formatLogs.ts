import { format, isAfter, isBefore, isWithinInterval, toDate } from 'date-fns'
import { logViewerDateAndTime, parseMessage } from '../../../shared/index.js'

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
      return `<red>[${level}]</red>`
    }
    case 'info': {
      return `<blue>[${level}]</blue>`
    }
    default: {
      return `<white>[${level}]</white>`
    }
  }
}

const templateMessage = (
  timestamp: number,
  labels: string[],
  message: string,
): string => {
  if (!message) {
    return ''
  }

  return (
    parseMessage(
      `\n<gray>${format(timestamp, logViewerDateAndTime)}</gray> ${labels.join(' ')}`,
    ) + `\n${message.trim()}`
  )
}

export const filterLogs = (
  data: EnvLogsData[] | AdminLogsData[],
  filters: BasedCli.Logs.Filter.Args,
) => {
  if (!data?.length) {
    return []
  }

  const sliceMessage: number = process.stdout.columns - 5
  const thresholdMessageLength: number = 4

  if (!filters.stream) {
    data = data.slice(0, filters.limit)
  }

  return data
    .map((log: any) => {
      const isMessageInvalid =
        !log.msg || log.msg.length < thresholdMessageLength
      const isLogLevelNotInfo = filters.level === 'info' && log.lvl === 'error'
      const isLogLevelNotError = filters.level === 'error' && log.lvl === 'info'
      const isFunctionNotIncluded =
        Array.isArray(filters.function) && !filters.function.includes(log.fn)
      const isServiceNotIncluded =
        Array.isArray(filters.service) && !filters.service.includes(log.srvc)
      const isChecksumInvalid = filters.checksum && log.cs !== filters.checksum
      const isMachineIDInvalid = filters.machine && log.mid !== filters.machine
      const isDateNotWithinInterval =
        typeof filters.startDate !== 'string' &&
        typeof filters.endDate !== 'string' &&
        filters.startDate?.timestamp &&
        filters.endDate?.timestamp &&
        !isWithinInterval(toDate(log.ts), {
          start: filters.startDate?.timestamp,
          end: filters.endDate?.timestamp,
        })
      const isCannotBeBefore =
        typeof filters.startDate !== 'string' &&
        !filters.endDate &&
        filters.startDate?.timestamp &&
        isBefore(log.ts, filters.startDate?.timestamp)
      const isCannotBeAfter =
        !filters.startDate &&
        typeof filters.endDate !== 'string' &&
        filters.endDate?.timestamp &&
        isAfter(log.ts, filters.endDate?.timestamp)

      if (
        isMessageInvalid ||
        isLogLevelNotInfo ||
        isLogLevelNotError ||
        isFunctionNotIncluded ||
        isServiceNotIncluded ||
        isChecksumInvalid ||
        isMachineIDInvalid ||
        isDateNotWithinInterval ||
        isCannotBeBefore ||
        isCannotBeAfter
      ) {
        return false
      }

      // TODO remove this strange line from the logs in the cloud
      log.msg = log.msg.replaceAll(
        '----------------------------------------------------',
        '',
      )

      // To guarantee non-empty logs are shown
      // TODO remove this if after refactoring the cloud function
      if (log.msg.length < thresholdMessageLength) {
        return false
      }

      if (filters.collapsed && log.msg.length > sliceMessage) {
        log.msg = log.msg?.slice(0, sliceMessage) + '...'
      }

      return log
    })
    .filter(Boolean)
}

export const formatLogs = (data: EnvLogsData[] | AdminLogsData[]) => {
  return data.map((log: EnvLogsData | AdminLogsData) => {
    let labels: string[]

    if ('cs' in log) {
      const { lvl, ts, fn, cs, msg } = log as EnvLogsData

      labels = [
        '<b><magenta>[app]</magenta></b>',
        `<b>${logLevelColor(lvl)}</b>`,
        `<yellow>[function: <b>${fn}</b>]</yellow>`,
        `<blue>[checksum: <b>${cs}</b>]</blue>`,
      ]

      return templateMessage(ts, labels, msg)
    } else {
      const { lvl, ts, srvc, mid, url, msg } = log as AdminLogsData

      labels = [
        '<b><magenta>[infra]</magenta></b>',
        `<b>${logLevelColor(lvl)}</b>`,
        `<yellow>[service: <b>${srvc}</b>]</yellow>`,
        `<green>[machineID: <b>${mid}</b>]</green>`,
        `<blue>[IP: <b>${url}</b>]</blue>`,
      ]

      return templateMessage(ts, labels, msg)
    }
  })
}
