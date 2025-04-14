import { exec } from 'node:child_process'

export const npmInstall = (path: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const child = exec('npm i', { cwd: path || process.cwd() })

    child.on('exit', (code) => {
      resolve(code === 0)
    })

    child.on('error', () => {
      resolve(false)
    })
  })
}
