import { exec } from 'node:child_process'

export const npmInstall = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const child = exec('npm i', { cwd: process.cwd() })

    child.on('exit', (code) => {
      resolve(code === 0)
    })

    child.on('error', () => {
      resolve(false)
    })
  })
}
