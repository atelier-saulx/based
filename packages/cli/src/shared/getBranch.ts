import { spawn } from 'node:child_process'

let env: string | undefined

export async function getBranch(path?: string): Promise<string> {
  if (env !== undefined) {
    return env
  }

  env = global?.ENV ?? process.env.ENV

  if (!env) {
    env = await new Promise<string>((resolve) => {
      const git = spawn('git', ['branch', '--show-current'], {
        cwd: path ?? process.cwd(),
        shell: true,
      })

      let output = ''
      git.stdout.on('data', (chunk) => {
        output += chunk.toString()
      })
      git.on('error', () => resolve(''))
      git.on('close', (code) => {
        if (code !== 0) return resolve('')
        resolve(output.trim())
      })
    })
  }

  return env
}
