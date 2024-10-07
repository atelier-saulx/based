import { AppContext } from '../../../shared/index.js'
import { Command } from 'commander'

export const make = (program: Command) => async () => {
  const context: AppContext = AppContext.getInstance(program)
  const { org, env, project } = await context.getProgram()
  const { destroy } = await context.getBasedClient()
  const { skip } = context.getGlobalOptions()

  if (!skip) {
    const doIt: boolean = await context.input.confirm(
      `Would you like to make a backup for the env '<cyan>${org}/${project}/${env}</cyan>'?`,
    )

    if (!doIt) {
      return
    }
  }

  try {
    await setMake(context)

    destroy()
    return
  } catch (error) {
    throw new Error(`Error making your backup: '${error}'`)
  }
}

export const setMake = async (context: AppContext) => {
  const { basedClient, adminHubBasedCloud } = await context.getBasedClient()
  const { org, env, project } = await context.getProgram()

  const { envId } = await basedClient.call('based:env-info').catch(() => {
    throw new Error(
      `Fatal error during <b>get your environment info</b>. Check your <b>'based.json'</b> file or <b>your arguments</b> and try again.`,
    )
  })

  context.print.line().loading('Making a new backup...')

  await adminHubBasedCloud.call('backup-env', {
    org,
    project,
    env,
    envId,
  })

  context.print.success(`Backup completed successfully!`, true)
}
