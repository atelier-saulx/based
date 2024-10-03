import { AppContext } from '../../../shared/index.js'
import { Command } from 'commander'

export const make = (program: Command) => async () => {
  const context: AppContext = AppContext.getInstance(program)
  const { org, env, project } = await context.getProgram()
  const { basedClient, adminHubBasedCloud, destroy } =
    await context.getBasedClient()
  const { skip } = context.getGlobalOptions()

  if (!skip) {
    const doIt: boolean = await context.input.confirm(
      `Would you like to make a backup for the env '<cyan>${org}/${project}/${env}</cyan>'?`,
    )

    if (!doIt) {
      return
    }
  }

  const { envId } = await basedClient.call('based:env-info').catch(() => {
    throw new Error(
      `Fatal error during <b>get your environment info</b>. Check your <b>'based.json'</b> file or <b>your arguments</b> and try again.`,
    )
  })

  try {
    context.print.line().loading('Making a new backup...')

    await adminHubBasedCloud.call('backup-env', {
      org,
      project,
      env,
      envId,
    })

    context.print.success(`Backup completed successfully!`, true)

    destroy()
    return
  } catch (error) {
    throw new Error(`Error making your backup: '${error}'`)
  }
}
