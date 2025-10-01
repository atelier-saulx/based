import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'

export const make = (program: Command) => async () => {
  const context: AppContext = AppContext.getInstance(program)
  const { destroy } = await context.getBasedClient()

  try {
    await setMake(context)

    destroy()
    return
  } catch (error) {
    throw new Error(context.i18n('errors.907', error))
  }
}

export const setMake = async (context: AppContext) => {
  const basedClient = await context.getBasedClient()
  const { org, env, project, file } = await context.getProgram()
  const { skip } = context.getGlobalOptions()

  if (!skip) {
    const doIt: boolean = await context.form.boolean(
      context.i18n(
        'commands.backups.subCommands.make.methods.confirmation',
        org,
        project,
        env,
      ),
    )

    context.print.pipe()

    if (!doIt) {
      return
    }
  }

  let envId: number

  try {
    const envInfo = await basedClient.call(context.endpoints.ENV_INFO)

    envId = envInfo.envId
  } catch {
    throw new Error(context.i18n('errors.404', file))
  }

  context.spinner.start(
    context.i18n('commands.backups.subCommands.make.methods.making'),
  )

  await basedClient.call(context.endpoints.BACKUPS_ENV, {
    org,
    project,
    env,
    envId,
  })

  context.print.success(
    context.i18n('commands.backups.subCommands.make.methods.success'),
  )
}
