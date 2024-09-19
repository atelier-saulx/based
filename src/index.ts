import { Command } from 'commander'
import { version } from './version.js'
import {
  auth,
  logs,
  deploy,
  globalOptions,
  dev,
  backup,
} from './commands/index.js'
import pc from 'picocolors'
import { spinner } from './shared/index.js'
import AppContext from './shared/AppContext.js'

export const init = async () => {
  const program: Command = new Command()
  const context: AppContext = AppContext.getInstance()

  try {
    await Promise.all([
      version(program, context),
      globalOptions(program, context),
      auth(program),
      dev(program),
      deploy(program),
      backup(program),
      logs(program),
    ])

    program.helpOption('-h, --help', 'Display the help for each command.')
    program.helpCommand(
      'help [command]',
      'Display the help related to the command.',
    )

    const { org, project, env, level } = program.opts()

    context.set('level', level)
    context.print.info(`<dim>org:</dim> <b>${org}</b>`)
    context.print.info(`<dim>project:</dim> <b>${project}</b>`)
    context.print.info(`<dim>env:</dim> <b>${env}</b>`)

    await program.parseAsync(process.argv)
  } catch (e) {
    spinner.stop()
    console.error(pc.red(e.message))
    process.exit(1)
  }
}
