import { exec } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { readJSON } from 'fs-extra/esm'
import { type AppContext, replaceTilde } from '../../shared/index.js'

const execAsync = promisify(exec)

export const checkScript = async (context: AppContext, command: string) => {
  const { scripts } = await readJSON(resolve(replaceTilde('./package.json')))

  if (scripts?.[command]) {
    return true
  }

  throw new Error(context.i18n('errors.911', command))
}

export const runTests = async ({
  context,
  command,
}: {
  context: AppContext
  command: string
}) => {
  await checkScript(context, command)

  try {
    context.print
      .info(`Running your command: '<b>${command}</b>'...`, '🛠️')
      .separator()
    const { stdout, stderr } = await execAsync(`npm run ${command}`)

    context.print.stop().info('<b><green>Tests that passed:</green></b>', '🎉')
    console.log(stdout.trim())

    context.print.separator()

    if (stderr) {
      context.print.stop().info('<b><red>Tests that failed:</red></b>', '😭')
      console.error(stderr.trim())
    }
  } catch (error) {
    throw new Error(
      `${error.message}\n<b>Details</b>: ${error.stderr.trim() || error.stdout.trim()}`,
    )
  }
}
