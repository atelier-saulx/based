import type { Command } from 'commander'
import { AppContext, endpoints } from '../../../context/index.js'

export const get =
  (program: Command) =>
  async ({ key }: Based.Secrets.Get.Command) => {
    const context: AppContext = AppContext.getInstance(program)
    const basedClient = await context.getBasedClient()

    try {
      const value = await basedClient.call(endpoints.SECRETS_GET, { key })

      if (value) {
        context.print
          .line()
          .success(
            context.i18n(
              'commands.secrets.subCommands.get.methods.success',
              key,
              value,
            ),
          )
      } else {
        context.print
          .line()
          .error(
            context.i18n(
              'commands.secrets.subCommands.get.methods.not_found',
              key,
            ),
          )
      }

      basedClient.destroy()
      return
    } catch {
      throw new Error(context.i18n('errors.910'))
    }
  }
