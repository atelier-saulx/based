import type { Command } from 'commander'
import { AppContext, endpoints } from '../../../context/index.js'

export const set =
  (program: Command) =>
  async ({ key, value }: Based.Secrets.Set.Command): Promise<void> => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const basedClient = await context.getBasedClient()

    try {
      if (!key) {
        context.print
          .line()
          .error(
            context.i18n('commands.secrets.subCommands.set.methods.not_key'),
          )
      } else if (!value) {
        context.print
          .line()
          .error(
            context.i18n('commands.secrets.subCommands.set.methods.not_value'),
          )
      } else {
        await basedClient.call(endpoints.SECRETS_SET, { key, value })

        context.print
          .line()
          .success(
            context.i18n(
              'commands.secrets.subCommands.set.methods.success',
              key,
            ),
          )
      }

      basedClient.destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }
