import { readJSON } from 'fs-extra/esm'
import { resolve } from 'node:path'
import { AppContext, replaceTilde } from '../../shared/index.js'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

export const checkScript = async (command: string) => {
  const { scripts } = await readJSON(resolve(replaceTilde('./package.json')))

  if (scripts && scripts?.[command]) {
    return true
  } else {
    throw new Error(
      `Error running your tests, was not possible to find the command: <b>'${command}'</b> in your <b>'package.json'</b>`,
    )
  }
}

export const runTests = async ({
  context,
  command,
}: {
  context: AppContext
  command: string
}) => {
  await checkScript(command)

  try {
    context.print
      .info(`Running your command: '<b>${command}</b>'...`, '🛠️')
      .separator()
    const { stdout, stderr } = await execAsync(`npm run ${command}`)

    context.print.stop().info(`<b><green>Tests that passed:</green></b>`, '🎉')
    console.log(stdout.trim())

    context.print.separator()

    if (stderr) {
      context.print.stop().info(`<b><red>Tests that failed:</red></b>`, '😭')
      console.error(stderr.trim())
    }
  } catch (error) {
    throw new Error(
      `${error.message}\n<b>Details</b>: ${error.stderr.trim() || error.stdout.trim()}`,
    )
  }
}
