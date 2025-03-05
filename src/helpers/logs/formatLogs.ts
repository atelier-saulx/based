import { format, isAfter, isBefore, isWithinInterval, toDate } from 'date-fns'
import { logViewerDateAndTime } from '../../shared/index.js'

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

  return `<reset><gray>[${format(timestamp, logViewerDateAndTime)}]</gray> ${labels.join(' ')}\n${message.trim()}\n</reset>`
}

const isToBeFiltered = (
  log: Based.Logs.EnvLogsData & Based.Logs.AdminLogsData,
  args: Based.Logs.Filter.Command,
) => {
  const isMessageInvalid = !log.msg || log.msg.length < thresholdMessageLength
  const isLogLevelNotInfo = args.level === 'info' && log.lvl === 'error'
  const isLogLevelNotError = args.level === 'error' && log.lvl === 'info'
  const isFunctionNotIncluded =
    Array.isArray(args.function) && !args.function.includes(log.fn)
  const isServiceNotIncluded =
    Array.isArray(args.service) && !args.service.includes(log.srvc)
  const isChecksumInvalid = args.checksum && log.cs !== args.checksum
  const isMachineIDInvalid = args.machine && log.mid !== args.machine
  const isDateNotWithinInterval =
    typeof args.startDate !== 'string' &&
    typeof args.endDate !== 'string' &&
    args.startDate?.timestamp &&
    args.endDate?.timestamp &&
    !isWithinInterval(toDate(log.ts), {
      start: args.startDate?.timestamp,
      end: args.endDate?.timestamp,
    })
  const isCannotBeBefore =
    typeof args.startDate !== 'string' &&
    !args.endDate &&
    args.startDate?.timestamp &&
    isBefore(log.ts, args.startDate?.timestamp)
  const isCannotBeAfter =
    !args.startDate &&
    typeof args.endDate !== 'string' &&
    args.endDate?.timestamp &&
    isAfter(log.ts, args.endDate?.timestamp)

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
  args: Based.Logs.Filter.Command,
) => {
  if (!data?.length) {
    return []
  }

  let logs = data

  if (!args.stream) {
    logs = data.slice(0, args.limit)
  }

  const sliceMessage: number = process.stdout.columns - 5

  return logs
    .map((log) => {
      const isCollapsed = args.collapsed && log.msg.length > sliceMessage

      if (isToBeFiltered(log, args)) {
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
        log.msg = `${log.msg?.slice(0, sliceMessage)}...`
      }

      return log
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateA: number = a.ts
      const dateB: number = b.ts
      const isDesc = args.sort === 'desc'
      const isAsc = args.sort === 'asc'
      const isMonitor = args.monitor

      if (isMonitor) {
        return dateA - dateB
      }

      if (isAsc) {
        return dateB - dateA
      }

      if (isDesc) {
        return dateA - dateB
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
    }

    const { lvl, ts, srvc, mid, url, msg } = log as Based.Logs.AdminLogsData

    labels = [
      '<b><magenta>[infra]</magenta></b>',
      `<b>${logLevelColor(lvl)}</b>`,
      `<yellow>[service: <b>${srvc}</b>]</yellow>`,
      `<green>[machineID: <b>${mid}</b>]</green>`,
      `<blue>[IP: <b>${url}</b>]</blue>`,
    ]

    return templateMessage(ts, labels, msg)
  })
}
