import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { colorize } from '../../../shared/index.js'

export const overview =
  (program: Command) => async (args: Based.Infra.Overview.Command) => {
    const { stream, monitor } = args
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClient()

    try {
      await getOverview({ context, stream, monitor })

      if (!stream) {
        destroy()
      }

      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const getOverview = async (args: Based.Infra.Overview.Get) => {
  const { context, stream = true, monitor = true } = args
  const basedClient = await context.getBasedClient()
  const { cluster, org, project, env } = context.get('basedProject')

  const templateLabels = (name: string, value: string) =>
    `${name}: <b>${value}</b>`

  const envLabels: string[] = [
    templateLabels('cluster', cluster),
    templateLabels('org', org),
    templateLabels('project', project),
    templateLabels('env', env),
  ]

  const headerTemplate = (connections: number = 0) => {
    return colorize([
      `${context.get('appTitle')}`,
      `Viewing Infra for Environment: [${envLabels.join(' | ')}] ${stream ? '<b><red>LIVE</red></b>' : ''}`,
      connections && `Active Connections: <b>${connections}</b>`,
    ])
  }

  if (monitor) {
    const { kill, header } = context.terminalKit({
      title: context.get('appName'),
      header: headerTemplate(),
      rows: {
        sort: 'asc',
      },
    })

    await basedClient
      .call(context.endpoints.CONNECTIONS)
      .subscribe((connections) => {
        header(headerTemplate(connections))
      })

    kill(() => {
      basedClient.destroy()
    })
  }
}
