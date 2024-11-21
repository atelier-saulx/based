let env: string = undefined

export const getBranch = async (): Promise<string> => {
  if (env === undefined) {
    env = global.ENV
    if (!env && typeof process === 'object') {
      env = process.env.ENV
      if (!env) {
        const { exec } = await import('node:child_process')
        env = await new Promise((resolve) => {
          return exec('git branch --show-current', (err, stdout) => {
            resolve(err ? '' : stdout.trim())
            if (err) {
              resolve('')
            }
          })
        })
      }
    }
    env ||= ''
  }

  return env
}
