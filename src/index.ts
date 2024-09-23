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
import AppContext from './shared/AppContext.js'

export const init = async () => {
  const program: Command = new Command()
  const context: AppContext = AppContext.getInstance()

  try {
    await Promise.all([
      version(program, context),
      globalOptions(program, context),
      auth(program, context),
      dev(program, context),
      deploy(program, context),
      backup(program, context),
      logs(program, context),
    ])

    const { org, project, env, level } = program.opts()

    context.set('level', level)
    context.print.info(`<dim>org:</dim> <b>${org}</b>`)
    context.print.info(`<dim>project:</dim> <b>${project}</b>`)
    context.print.info(`<dim>env:</dim> <b>${env}</b>`)

    await program.parseAsync(process.argv)
  } catch (e) {
    context.print.fail(`<red>${e.message}</red>`)
  }
}
