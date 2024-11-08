import { Command } from 'commander'
import {
  auth,
  backup,
  deploy,
  dev,
  infra,
  logs,
  test,
  version,
} from './commands/index.js'
import { globalOptions } from './helpers/index.js'
import { languages } from './i18n/index.js'
import { AppContext } from './shared/index.js'

export const init = async () => {
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

    await program.parseAsync(process.argv)
  } catch (e) {
    context.print.fail(`<reset><red>${e.message}</red></reset>`)
  }
}
