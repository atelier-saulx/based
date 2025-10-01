import { Command } from 'commander'
import {
  auth,
  backup,
  deploy,
  dev,
  disconnect,
  infra,
  logs,
  projectInit,
  test,
  version,
} from './commands/index.js'
import { AppContext } from './context/index.js'
import { globalOptions } from './helpers/index.js'
import { languages } from './i18n/index.js'

export const cli = async () => {
  const program: Command = new Command()
  const context: AppContext = AppContext.getInstance(program, languages)

  try {
    await Promise.all([
      version(program),
      globalOptions(program),
      auth(program),
      disconnect(program),
      dev(program),
      deploy(program),
      backup(program),
      logs(program),
      test(program),
      infra(program),
      projectInit(program),
    ])

    const appName = context.get('appName')
    const versionNo = context.get('appVersion')
    context.print.intro(
      `<bgPrimary><b> ${appName} </b></bgPrimary> <dim>${versionNo}</dim>`,
    )

    await program.parseAsync(process.argv)
  } catch (error) {
    if (error.stack) {
      console.error(
        context.state.emojis.error,
        '<reset><red>',
        error.stack,
        '</red></reset>',
      )
    } else {
      console.error(
        context.state.emojis.error,
        '<reset><red>',
        error,
        '</red></reset>',
      )
    }

    process.exit(1)
  }
}
