import { AppContext } from '../../../shared/index.js'
import { Command } from 'commander'

export const make = (program: Command) => async () => {
  const context: AppContext = AppContext.getInstance(program)
  const { destroy } = await context.getBasedClient()

  try {
    await setMake(context)

    destroy()
    return
  } catch (error) {
    throw new Error(`Error making your backup: '${error}'`)
  }
}

export const setMake = async (context: AppContext) => {
  const basedClient = await context.getBasedClient()
  const { org, env, project, file } = await context.getProgram()
  const { skip } = context.getGlobalOptions()

  context.print.line()

  if (!skip) {
    const doIt: boolean = await context.input.confirm(
      `Would you like to make a backup for the env <reset><cyan>${org}/${project}/${env}</cyan></reset>?`,
    )

    if (!doIt) {
      return
    }
  }

  let envId: number

  try {
    const envInfo = await basedClient.call(context.endpoints.ENV_INFO)
    envId = envInfo.envId
  } catch {
    throw new Error(
      `Fatal error during <b>get your environment info</b>. Check your '<b>${file}</b>' file or <b>your arguments</b> and try again.`,
    )
  }

  context.print.loading('Making a new backup...')

  await basedClient.call(context.endpoints.BACKUPS_ENV, {
    org,
    project,
    env,
    envId,
  })

  context.print.stop().success(`Backup created successfully!`, true)
}
