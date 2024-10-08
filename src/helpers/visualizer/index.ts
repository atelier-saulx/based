import { AppContext, getTerminal } from '../../shared/index.js'
import {
  AdminLogsData,
  EnvLogsData,
  filterLogs,
  formatLogs,
  subscribeLogs,
  getLogs,
} from '../logs/index.js'

export const visualizer = async (
  context: AppContext,
  filters: BasedCli.Logs.Filter,
) => {
  const { basedClient, envHubBasedCloud, adminHubBasedCloud } =
    await context.getBasedClients()
  const { cluster, org, env, project } = await context.getProgram()

  const templateLabels = (name: string, value: string) =>
    `${name}: <b>${value}</b>`

  const filterLabels: string[] = []
  const envLabels: string[] = [
    templateLabels('cluster', cluster),
    templateLabels('org', org),
    templateLabels('project', project),
    templateLabels('env', env),
  ]

  const isLogsFrom =
    !filters.app && !filters.infra
      ? 'app + infra'
      : !filters.app && filters.infra
        ? 'infra'
        : 'app'
  filterLabels.push(templateLabels('logs from', isLogsFrom))

  if (filters.collapsed) {
    filterLabels.push(templateLabels('collapsed', String(filters.collapsed)))
  }

  if (filters.level) {
    filterLabels.push(templateLabels('level', filters.level))
  }

  if (filters.startDate && typeof filters.startDate !== 'string') {
    filterLabels.push(templateLabels('start date', filters.startDate.value))
  }

  if (filters.endDate && typeof filters.endDate !== 'string') {
    filterLabels.push(templateLabels('end date', filters.endDate.value))
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

  let renderData: (...data: AdminLogsData[] | EnvLogsData[]) => void

  if (filters.monitor) {
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

    renderData = (...data: AdminLogsData[] | EnvLogsData[]) =>
      addMessage(formatLogs(filterLogs(data, filters)))
  } else {
    renderData = (...data: AdminLogsData[] | EnvLogsData[]) => {
      const filteredData = formatLogs(filterLogs(data, filters))

      for (const line of filteredData) {
        console.log(line)
      }

      if (filteredData.length && !filters.stream) {
        context.print.separator()
      }

      if (!filteredData.length) {
        context.print.line()
      }

      if (!filters.stream) {
        context.print.info(
          `Displaying <b>${filteredData.length}</b> logs <b>filtered</b> by the parameters: [${filterLabels.join(' | ')}]`,
        )
      }
    }
  }

  if (filters.monitor) {
    context.print
      .line()
      .stop()
      .success('Opening the <b>UI</b> to show the logs...', true)
  }

  try {
    if (filters.stream) {
      await subscribeLogs(context, filters, renderData)
    } else {
      await getLogs(context, filters, renderData)
    }
  } catch (error) {
    throw new Error(error)
  }
}
