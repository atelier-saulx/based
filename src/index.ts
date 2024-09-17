import { Command } from 'commander'
import { version } from './version.js'
import { deploy } from './commands/deploy/index.js'
import { globalOptions } from './commands/globalOptions/index.js'
import { auth } from './commands/auth/index.js'
import pc from 'picocolors'
import { spinner } from './shared/index.js'
import { dev } from './commands/dev/index.js'
import { backup } from './commands/backup/index.js'

export const init = async () => {
  const program: Command = new Command()

  try {
    await Promise.all([
      version(program),
      globalOptions(program),
      auth(program),
      dev(program),
      deploy(program),
      backup(program),
    ])

    program.helpOption('-h, --help', 'Display the help for each command.')
    program.helpCommand(
      'help [command]',
      'Display the help related to the command.',
    )

    const opts = program.opts()

    for (const arg in opts) {
      console.info(pc.dim(arg), opts[arg])
    }

    await program.parseAsync(process.argv)
  } catch (e) {
    spinner.stop()
    console.error(pc.red(e.message))
    process.exit(1)
  }
}
