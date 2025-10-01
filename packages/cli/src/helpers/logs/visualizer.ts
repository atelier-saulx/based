import type { AppContext } from '../../context/index.js'
import { filterLogs, formatLogs, getLogs, subscribeLogs } from './index.js'

export const visualizer = async (
  context: AppContext,
  args: Based.Logs.Filter.Command,
) => {
  const { destroy } = await context.getBasedClient()
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
    !args.app && !args.infra
      ? 'app + infra'
      : !args.app && args.infra
        ? 'infra'
        : 'app'
  filterLabels.push(templateLabels('logs from', isLogsFrom))

  if (args.collapsed) {
    filterLabels.push(templateLabels('collapsed', String(args.collapsed)))
  }

  if (args.level) {
    filterLabels.push(templateLabels('level', args.level))
  }

  if (args.startDate && typeof args.startDate !== 'string') {
    filterLabels.push(templateLabels('start date', args.startDate.value))
  }

  if (args.endDate && typeof args.endDate !== 'string') {
    filterLabels.push(templateLabels('end date', args.endDate.value))
  }

  if (args.function) {
    filterLabels.push(
      templateLabels(
        'function',
        Array.isArray(args.function) ? args.function.join(', ') : args.function,
      ),
    )
  }

  if (args.service) {
    filterLabels.push(
      templateLabels(
        'service',
        Array.isArray(args.service) ? args.service.join(', ') : args.service,
      ),
    )
  }

  if (args.checksum) {
    filterLabels.push(templateLabels('checksum', String(args.checksum)))
  }

  if (!args.stream) {
    filterLabels.push(
      templateLabels('limit', String(args.limit)),
      templateLabels('sorting', String(args.sort)),
    )
  }

  let renderData: Based.Logs.RenderData

  if (args.monitor) {
    const appName = context.get('appName')
    const versionNo = context.get('appVersion')

    const { kill, addRow } = context.terminalKit({
      title: appName,
      header: [
        `<bgPrimary><b> ${appName} </b></bgPrimary> <dim>${versionNo}</dim>`,
        `Viewing Logs for Environment: [${envLabels.join(' | ')}] ${args.stream ? '<b><red>LIVE</red></b>' : ''}`,
        `Active Filters: [${filterLabels.join(' | ')}]`,
      ],
      rows: {
        sort: args.sort,
      },
    })

    kill(() => {
      destroy()
    })

    renderData = (data) => addRow(formatLogs(filterLogs(data, args)))
  } else {
    renderData = (data) => {
      const filteredData = formatLogs(filterLogs(data, args))

      for (const line of filteredData) {
        console.log(line)
      }

      if (filteredData.length && !args.stream) {
        context.print.separator()
      }

      if (!filteredData.length) {
        context.print.line()
      }

      if (!args.stream) {
        context.print.log(
          `Displaying <b>${filteredData.length}</b> logs <b>filtered</b> by the parameters: [${filterLabels.join(' | ')}]`,
        )
      }
    }
  }

  try {
    if (args.stream) {
      await subscribeLogs(context, args, renderData)
    } else {
      await getLogs(context, args, renderData)
    }
  } catch (error) {
    throw new Error(error)
  }
}
