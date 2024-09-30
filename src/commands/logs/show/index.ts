import { getTerminal } from '../../../shared/index.js'
import {
  AdminLogsData,
  EnvLogsData,
  filterLogs,
  formatLogs,
} from './formatLogs.js'
import { subscribeLogs } from './subscribeLogs.js'
import { getLogs } from './getLogs.js'

export const show = async ({
  context,
  basedClient,
  envHubBasedCloud,
  adminHubBasedCloud,
  cluster,
  org,
  env,
  project,
  filters,
}) => {
  const templateLabels = (name: string, value: string) =>
    `${name}: <b>${value}</b>`

  const filterLabels: string[] = []
  const envLabels: string[] = [
    templateLabels('cluster', cluster),
    templateLabels('org', org),
    templateLabels('project', project),
    templateLabels('env', env),
  ]

  if (!filters.app && !filters.infra) {
    filterLabels.push(templateLabels('logs from', 'app + infra'))
  } else if (!filters.app && filters.infra) {
    filterLabels.push(templateLabels('logs from', 'infra'))
  } else if (filters.app && !filters.infra) {
    filterLabels.push(templateLabels('logs from', 'app'))
  }

  if (filters.collapsed) {
    filterLabels.push(templateLabels('collapsed', String(filters.collapsed)))
  }

  if (filters.level) {
    filterLabels.push(templateLabels('level', filters.level))
  }

  if (filters.startDate) {
    filterLabels.push(templateLabels('start date', filters.startDate))
  }

  if (filters.endDate) {
    filterLabels.push(templateLabels('end date', filters.endDate))
  }

  if (filters.function) {
    filterLabels.push(
      templateLabels(
        'function',
        Array.isArray(filters.function)
          ? filters.function.join(', ')
          : filters.function,
      ),
    )
  }

  if (filters.service) {
    filterLabels.push(
      templateLabels(
        'service',
        Array.isArray(filters.service)
          ? filters.service.join(', ')
          : filters.service,
      ),
    )
  }

  if (filters.checksum) {
    filterLabels.push(templateLabels('checksum', String(filters.checksum)))
  }

  if (!filters.stream) {
    filterLabels.push(
      templateLabels('limit', String(filters.limit)),
      templateLabels('sorting', String(filters.sort)),
    )
  }

  const { kill, addMessage } = getTerminal(
    context.get('appName'),
    `${context.get('appTitle')}\n` +
      `Viewing Logs for Environment: [${envLabels.join(' | ')}] ${filters.stream ? '<b><red>LIVE</red></b>' : ''}\n` +
      `Active Filters: [${filterLabels.join(' | ')}]`,
    filters.sort,
  )

  kill(() => {
    basedClient.destroy()
    envHubBasedCloud.destroy()
    adminHubBasedCloud.destroy()
    process.exit(0)
  })

  const newData = (data: AdminLogsData[] | EnvLogsData[]) =>
    addMessage(formatLogs(filterLogs(data, filters)))
  // const newData = (data: AdminLogsData[] | EnvLogsData[]) =>
  //   formatLogs(filterLogs(data, filters))

  try {
    if (filters.stream) {
      await subscribeLogs({
        envHubBasedCloud,
        adminHubBasedCloud,
        cluster,
        org,
        env,
        project,
        filters,
        newData,
      })
    } else {
      await getLogs({
        envHubBasedCloud,
        adminHubBasedCloud,
        cluster,
        org,
        env,
        project,
        filters,
        newData,
      })
    }
  } catch (error) {
    throw new Error(error)
  }
}
