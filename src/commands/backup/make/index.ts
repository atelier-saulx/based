import { Command } from 'commander'
import confirm from '@inquirer/confirm'
import { basedAuth, spinner } from '../../../shared/index.js'
import pc from 'picocolors'

export const make = (program: Command) => async () => {
  const { org, project, env } = program.opts()
  const { basedClient, adminHubBasedCloud, destroy } = await basedAuth(program)

  const doIt: boolean = await confirm({
    message: `Would you like to make a backup for the env '${pc.cyan(`${org}/${project}/${env}`)}'?`,
    default: true,
  })

  if (!doIt) {
    return
  }

  const { envId } = await basedClient.call('based:env-info').catch(() => {
    spinner.fail(
      `Could not get env info, check your 'based.json' file or your arguments and try again.`,
    )
    process.exit(1)
  })

  try {
    spinner.start('Making a new backup...')

    await adminHubBasedCloud.call('backup-env', {
      org,
      project,
      env,
      envId,
    })

    spinner.succeed(`Backup completed successfully!`)
  } catch (error) {
    spinner.fail(`Error making your backup: '${error}'`)
    process.exit(1)
  }

  destroy()
  return
}
