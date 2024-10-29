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
    return (
      `${context.get('appTitle')}\n` +
      `Viewing Infra from: [<b><cyan>${cluster}/${org}/${project}/${env}</cyan></b>] ${stream ? '<b><red>LIVE</red></b>' : ''}\n` +
      `Active Connections: <b>${connections}</b>`
    )
  }

  const { kill, header } = context.getTerminal(context.get('appName'))

  await basedClient.query('based:connections').subscribe((connections) => {
    header(headerTemplate(connections))
  })

  kill(() => {
    destroy()
    process.exit(0)
  })
}
