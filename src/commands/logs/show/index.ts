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

  if (filters.before) {
    filterLabels.push(templateLabels('before', filters.before))
  }

  if (filters.after) {
    filterLabels.push(templateLabels('after', filters.after))
  }

  if (filters.function) {
    filterLabels.push(
      templateLabels(
        'functions',
        Array.isArray(filters.function)
          ? filters.function.join(', ')
          : filters.function,
      ),
    )
  }

  if (filters.service) {
    filterLabels.push(
      templateLabels(
        'services',
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
      `Active Filters: [${filterLabels.join(' | ')}]\n` +
      '─'.repeat(process.stdout.columns),
    filters.sort,
  )

  kill(() => {
    basedClient.destroy()
    envHubBasedCloud.destroy()
    adminHubBasedCloud.destroy()
    process.exit(0)
  })

  // const newData = (data: AdminLogsData[] | EnvLogsData[]) =>
  //   addMessage(formatLogs(filterLogs(data, filters)))
  const newData = (data: AdminLogsData[] | EnvLogsData[]) =>
    console.log(filterLogs(data, filters).length)

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
