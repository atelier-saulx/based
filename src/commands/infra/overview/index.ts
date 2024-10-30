import { Command } from 'commander'
import { AppContext } from '../../../shared/index.js'

export const overview =
  (program: Command) =>
  async ({ stream }) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    // const { destroy } = await context.getBasedClients()

    try {
      await getOverview(context, stream)

      //   destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const getOverview = async (context: AppContext, stream = true) => {
  const { basedClient, destroy } = await context.getBasedClients()
  const { cluster, org, project, env } = context.get('basedProject')

  const headerTemplate = (connections: number = 0) => {
    return [
      `${context.get('appTitle')}`,
      `Viewing Infra from: [<b><cyan>${cluster}/${org}/${project}/${env}</cyan></b>] ${stream ? '<b><red>LIVE</red></b>' : ''}`,
      `Active Connections: <b>${connections}</b>`,
    ]
  }

  const { kill, header, addLine } = context.getTerminal({
    title: context.get('appName'),
    lines: {
      sort: 'asc',
    },
  })

  await basedClient.query('based:connections').subscribe((connections) => {
    header(headerTemplate(connections))
  })

  let counter = 0
  setInterval(() => {
    addLine(String(counter++))
  }, 100)

  kill(() => {
    destroy()
    process.exit(0)
  })
}
