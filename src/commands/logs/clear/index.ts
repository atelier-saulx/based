import { AppContext } from '../../../shared/index.js'
import { Command } from 'commander'

export const clear = (program: Command) => async () => {
  const context: AppContext = AppContext.getInstance(program)
  const basedClient = await context.getBasedClient()

  context.print.info(
    `<b>Warning! This action cannot be undone. Proceed only if you know what you're doing.</b>`,
  )

  const doIt: boolean = await context.input.confirm()

  if (!doIt) {
    throw new Error('Operation cancelled.')
  }

  try {
    context.print.loading('Cleaning your logs...')
    await basedClient.call(context.endpoints.LOGS_DELETE)

    context.print.success(`Logs cleaned successfully!`)

    basedClient.destroy()
    return
  } catch (error) {
    throw new Error(`Error cleaning your logs: '${error}'`)
  }
}
