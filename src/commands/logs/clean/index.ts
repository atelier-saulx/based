import { Command } from 'commander'
import { basedAuth, AppContext } from '../../../shared/index.js'

export const clean = (program: Command, context: AppContext) => async () => {
  const { basedClient, destroy } = await basedAuth(program, context)

  context.print.info(
    `<b>Warning! This action cannot be undone. Proceed only if you know what you're doing.</b>`,
  )

  const doIt: boolean = await context.input.confirm()

  if (!doIt) {
    throw new Error('Operation cancelled.')
  }

  try {
    context.print.loading('Cleaning your logs...')
    await basedClient.call('based:logs-delete')

    context.print.success(`Logs cleaned successfully!`)

    destroy()
    return
  } catch (error) {
    throw new Error(`Error cleaning your logs: '${error}'`)
  }
}
