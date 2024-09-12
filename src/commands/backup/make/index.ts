import { Command } from 'commander'
import confirm from '@inquirer/confirm'
import { basedAuth, spinner } from '../../../shared/index.js'

export const make = (program: Command) => async () => {
  const { org, project, env } = program.opts()
  const { basedClient, adminHubBasedCloud, destroy } = await basedAuth(program)

  const yes: boolean = await confirm({
    message: `Would you like to execute a backup for env ${org}/${project}/${env} ?`,
  })

  if (!yes) {
    return
  }

  const { envId } = await basedClient.call('based:env-info').catch(() => {
    spinner.fail(
      `Could not get env info, check your based.json file or your arguments and try again.`,
    )
    process.exit(1)
  })

  await adminHubBasedCloud.call('backup-env', {
    org,
    project,
    env,
    envId,
  })

  spinner.succeed(`💾 Backup completed successfully!`)
  destroy()
}
