import { Command } from 'commander'
import { basedAuth } from '../../../shared/index.js'
import AppContext from '../../../shared/AppContext.js'

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
    context.print.fail(
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
  } catch (error) {
    context.print.fail(`Error making your backup: '${error}'`)
  }

  destroy()
  return
}
