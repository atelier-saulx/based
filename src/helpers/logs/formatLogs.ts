import { format, isAfter, isBefore, isWithinInterval, toDate } from 'date-fns'
import { logViewerDateAndTime, colorize } from '../../shared/index.js'

const thresholdMessageLength: number = 4

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

  return colorize(
    `<reset><gray>${format(timestamp, logViewerDateAndTime)}</gray> ${labels.join(' ')}\n${message.trim()}\n</reset>`,
  )
}

const isToBeFiltered = (
  log: Based.Logs.EnvLogsData & Based.Logs.AdminLogsData,
  filters: Based.Logs.Filter,
) => {
  const isMessageInvalid = !log.msg || log.msg.length < thresholdMessageLength
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

  return (
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
  )
}

export const filterLogs = (
  data: Based.Logs.EnvLogsData[] | Based.Logs.AdminLogsData[],
  filters: Based.Logs.Filter,
) => {
  if (!data?.length) {
    return []
  }

  if (!filters.stream) {
    data = data.slice(0, filters.limit)
  }

  const sliceMessage: number = process.stdout.columns - 5

  return data
    .map((log: any) => {
      const isCollapsed = filters.collapsed && log.msg.length > sliceMessage

      if (isToBeFiltered(log, filters)) {
        return false
      }

      // TODO remove this strange line from the logs in the cloud
      log.msg = log.msg.replaceAll(
        '----------------------------------------------------',
        '',
      )

      const isMessageInvalid =
        !log.msg || log.msg.length < thresholdMessageLength

      // To guarantee non-empty logs are shown
      // TODO remove this if after refactoring the cloud function
      if (isMessageInvalid) {
        return false
      }

      if (isCollapsed) {
        log.msg = log.msg?.slice(0, sliceMessage) + '...'
      }

      return log
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateA: number = a.ts
      const dateB: number = b.ts
      const isDesc = filters.sort === 'desc'
      const isAsc = filters.sort === 'asc'
      const isMonitor = filters.monitor

      if (isMonitor) {
        return dateA - dateB
      } else {
        if (isAsc) {
          return dateB - dateA
        } else if (isDesc) {
          return dateA - dateB
        }
      }

      return 0
    })
}

export const formatLogs = (
  data: Based.Logs.EnvLogsData[] | Based.Logs.AdminLogsData[],
) => {
  return data.map((log: Based.Logs.EnvLogsData | Based.Logs.AdminLogsData) => {
    let labels: string[]

    if ('cs' in log) {
      const { lvl, ts, fn, cs, msg } = log as Based.Logs.EnvLogsData

      labels = [
        '<b><magenta>[app]</magenta></b>',
        `<b>${logLevelColor(lvl)}</b>`,
        `<yellow>[function: <b>${fn}</b>]</yellow>`,
        `<blue>[checksum: <b>${cs}</b>]</blue>`,
      ]

      return templateMessage(ts, labels, msg)
    } else {
      const { lvl, ts, srvc, mid, url, msg } = log as Based.Logs.AdminLogsData

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
