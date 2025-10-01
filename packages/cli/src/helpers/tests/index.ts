import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { readJSON } from 'fs-extra/esm'
import type { AppContext } from '../../context/index.js'
import { replaceTilde } from '../../shared/index.js'

export const checkScript = async (context: AppContext, command: string) => {
  try {
    const { scripts } = await readJSON(resolve(replaceTilde('./package.json')))

    if (scripts?.[command]) {
      return true
    }

    throw new Error(context.i18n('errors.911', command))
  } catch {
    throw new Error(context.i18n('errors.911', command))
  }
}

const runCommand = async (
  cmd: string,
  args: string[],
  options = {},
): Promise<{ code: number }> => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    child.on('error', reject)

    child.on('close', (code) => {
      resolve({ code })
    })
  })
}

export const runTests = async ({
  context,
  command,
}: {
  context: AppContext
  command: string
}) => {
  try {
    context.print
      .step(`Running your NPM script: '<b>${command}</b>'.`)
      .separator()

    const { code } = await runCommand('npm', ['run', command], {
      cwd: process.cwd(),
      env: process.env,
    })

    if (code) {
      throw new Error(String(code))
    }

    context.print
      .separator()
      .success(`NPM script '<b>${command}</b>' executed successfully!`)
  } catch (error) {
    throw new Error(
      `An error occurred while executing the script: ${error.message} | <b>Details</b>: ${error.stderr || error.stdout}`,
    )
  }
}
