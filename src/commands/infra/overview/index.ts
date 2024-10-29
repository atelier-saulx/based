import { Command } from 'commander'
import { AppContext } from '../../../shared/index.js'

export const overview =
  (program: Command) =>
  async ({}) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClients()

    try {
      await getOverview({ context })

      destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const getOverview = async ({ context }) => {
  const { basedClient } = await context.getBasedClients()

  const { data } = basedClient.call('based:connections')

  console.log('data', data)
}
