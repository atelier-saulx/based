import { Command } from 'commander'
import {
  auth,
  logs,
  deploy,
  dev,
  backup,
  version,
  test,
  infra,
} from './commands/index.js'
import { globalOptions } from './helpers/index.js'
import { AppContext } from './shared/index.js'
import { languages } from './i18n/index.js'

export const init = async (extract?: boolean) => {
  const program: Command = new Command()
  const context: AppContext = AppContext.getInstance(program, languages)

  try {
    await Promise.all([
      version(program),
      globalOptions(program),
      auth(program),
      dev(program),
      deploy(program),
      backup(program),
      logs(program),
      test(program),
      infra(program),
    ])

    if (extract) {
      program.parse(process.argv)
      return program
    }

    await program.parseAsync(process.argv)
  } catch (e) {
    context.print.fail(`<red>${e.message}</red>`)
  }
}
