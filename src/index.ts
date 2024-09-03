import { Command } from 'commander'
import { version } from './version.js'
import { deploy } from './commands/deploy/index.js'
import { globalOptions } from './globalOptions.js'
import { login } from './commands/login/index.js'
import pc from 'picocolors'
import { spinner } from './shared/spinner.js'
import { dev } from './commands/dev/index.js'

export const init = async () => {
  const program = new Command()

  try {
    await Promise.all([
      globalOptions(program),
      version(program),
      // commands
      deploy(program),
      login(program),
      dev(program),
    ])

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
