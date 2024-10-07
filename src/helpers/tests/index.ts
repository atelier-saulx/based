import { readJSON } from 'fs-extra/esm'
import { resolve } from 'node:path'
import { replaceTilde } from '../../shared/index.js'
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

export const runTests = async ({ context, command }) => {
  await checkScript(command)

  try {
    context.print.loading('Running your tests...')
    const { stdout, stderr } = await execAsync(`npm run ${command}`)

    context.print.stop().info(`The result of the command '${command}':`)
    console.log(stdout)

    if (stderr) {
      context.print.line().info(`The error of the command '${command}':`)
      console.error(stderr)
    }
  } catch (error) {
    throw new Error(
      `Error running your tests: ${error.message}\nDetails: ${error.stderr || error.stdout}`,
    )
  }
}
