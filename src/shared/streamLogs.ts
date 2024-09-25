import diff from 'arr-diff'
import {
  AdminLogsData,
  EnvLogsData,
  filterLogs,
  formatLogs,
  getTerminal,
} from './index.js'

export const streamLogs = async ({
  context,
  basedClient,
  adminHubBasedCloud,
  envHubBasedCloud,
  cluster,
  org,
  env,
  project,
  filters: {
    isCollapsed,
    isApp,
    isInfra,
    byLevel,
    byDateBefore,
    byDateAfter,
    byFunctions,
    byChecksum,
    byServices,
  },
}) => {
  let logsFrom: string = ''
  const filterList: string[] = []

  if (!isApp && !isInfra) {
    filterList.push(`logs from: <b>app + infra</b>`)
  } else if (!isApp && isInfra) {
    filterList.push(`logs from: <b>infra</b>`)
  } else if (isApp && !isInfra) {
    filterList.push(`logs from: <b>app</b>`)
  }

  if (isCollapsed) {
    filterList.push(`collapsed: <b>${isCollapsed}</b>`)
  }

  if (byLevel) {
    filterList.push(`levels: <b>${byLevel}</b>`)
  }

  if (byDateBefore) {
    filterList.push(`before: <b>${byDateBefore}</b>`)
  }

  if (byDateAfter) {
    filterList.push(`after: <b>${byDateAfter}</b>`)
  }

  if (byFunctions) {
    filterList.push(`functions: <b>${byFunctions}</b>`)
  }

  if (byServices) {
    filterList.push(`services: <b>${byServices}</b>`)
  }

  if (byChecksum) {
    filterList.push(`checksum: <b>${byChecksum}</b>`)
  }

  const { kill, addMessage } = getTerminal(
    'Based CLI',
    `<b>Based CLI</b>` +
      `\nViewing Logs for Environment: [cluster: <b>${cluster}</b> | org: <b>${org}</b> | project: <b>${project}</b> | env: <b>${env}</b>]` +
      `\nActive Filters: [${filterList.join(' | ')}]\n` +
      '─'.repeat(process.stdout.columns),
  )

  kill(() => {
    basedClient.destroy()
    envHubBasedCloud.destroy()
    adminHubBasedCloud.destroy()
    process.exit(0)
  })

  let adminLogsPrevious: AdminLogsData[] = []
  let envLogsPrevious: EnvLogsData[] = []
  const filters = {
    isCollapsed,
    isApp,
    isInfra,
    byLevel,
    byDateBefore,
    byDateAfter,
    byFunctions,
    byChecksum,
    byServices,
  }

  if ((isApp && isInfra) || (!isApp && isInfra) || (!isApp && !isInfra)) {
    await adminHubBasedCloud
      .query('logs', {
        cluster,
        org,
        env,
        project,
      })
      .subscribe(async (data: AdminLogsData[]) => {
        if (!Array.isArray(data)) {
          context.print.fail('Fatal error reading your logs. Try again.')
        }

        addMessage(
          formatLogs(filterLogs(diff(adminLogsPrevious, data), filters)),
        )
        // formatLogs(filterLogs(diff(adminLogsPrevious, data), filters))
        adminLogsPrevious = data
      })
  }

  if ((isApp && isInfra) || (isApp && !isInfra) || (!isApp && !isInfra)) {
    await envHubBasedCloud
      .query('based:logs')
      .subscribe(async (data: EnvLogsData[]) => {
        if (!Array.isArray(data)) {
          context.print.fail('Fatal error reading your logs. Try again.')
        }

        addMessage(formatLogs(filterLogs(diff(envLogsPrevious, data), filters)))
        // formatLogs(filterLogs(diff(envLogsPrevious, data), filters))
        envLogsPrevious = data
      })
  }
}
