import { Command } from 'commander'
import { basedAuth, spinner } from '../../../shared/index.js'
import pc from 'picocolors'
import { confirmInput } from '../../../shared/inputs.js'

export const clean = (program: Command) => async () => {
  const { basedClient, destroy } = await basedAuth(program)

  console.info(
    `⚠️ ${pc.bold("Warning! This action cannot be undone. Proceed only if you know what you're doing.")}`,
  )

  const doIt: boolean = await confirmInput()

  if (!doIt) {
    spinner.fail('Operation cancelled.')
    process.exit(1)
  }

  try {
    spinner.start('Cleaning your logs...')
    await basedClient.call('based:logs-delete')

    spinner.succeed(`Logs cleaned successfully!`)
  } catch (error) {
    spinner.fail(`Error cleaning your logs: '${error}'`)
    process.exit(1)
  }

  destroy()
  return
}
