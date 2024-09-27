import { Command } from 'commander'
import { basedAuth, AppContext } from '../../../shared/index.js'

export const make = (program: Command, context: AppContext) => async () => {
  const { org, project, env } = program.opts()
  const { basedClient, adminHubBasedCloud, destroy } = await basedAuth(
    program,
    context,
  )

  const doIt: boolean = await context.input.confirm(
    `Would you like to make a backup for the env '<cyan>${org}/${project}/${env}</cyan>'?`,
  )

  if (!doIt) {
    return
  }

  const { envId } = await basedClient.call('based:env-info').catch(() => {
    throw new Error(
      `Could not get env info, check your 'based.json' file or your arguments and try again.`,
    )
  })

  try {
    context.print.loading('Making a new backup...')

    await adminHubBasedCloud.call('backup-env', {
      org,
      project,
      env,
      envId,
    })

    context.print.success(`Backup completed successfully!`)

    destroy()
    return
  } catch (error) {
    throw new Error(`Error making your backup: '${error}'`)
  }
}
