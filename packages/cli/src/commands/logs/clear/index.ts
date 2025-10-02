import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'

export const clear = (program: Command) => async () => {
  const context: AppContext = AppContext.getInstance(program)
  const basedClient = await context.getBasedClient()

  context.print.log(context.i18n('methods.warning'))

  const doIt: boolean = await context.input.confirm()

  if (!doIt) {
    throw new Error(context.i18n('methods.aborted'))
  }

  try {
    context.spinner.start(
      context.i18n('commands.logs.subCommands.clear.cleaning'),
    )
    await basedClient.call(context.endpoints.LOGS_DELETE)

    context.print.success(
      context.i18n('commands.logs.subCommands.clear.success'),
    )

    basedClient.destroy()
    return
  } catch {
    throw new Error(context.i18n('errors.910'))
  }
}
