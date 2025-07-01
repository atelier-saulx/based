import { execSync } from 'child_process'
import { readdir } from 'fs/promises'
import { join } from 'path'
import os from 'node:os'

const getUser = () => {
  const hostname = os.hostname()
  const platform = os.platform()
  const release = os.release()
  const arch = os.arch()
  const cores = os.cpus().length
  const memory = (os.totalmem() / 1024 ** 3).toFixed(2) // Memory in GB

  return `${hostname}-${platform}${release}-${arch}-${cores}cores-${memory}GB`
}

const dirs = await readdir(import.meta.dirname)
for (let dir of dirs) {
  const dirpath = join(import.meta.dirname, dir)
  try {
    const files = await readdir(dirpath)
    for (const file of files) {
      if (file[0] !== '.') {
        const filepath = join(dirpath, file)
        const res = execSync('npx tsx ' + filepath, {
          stdio: ['ignore'],
        })
          .toString()
          .trim()
        console.log(res)
      }
    }
  } catch (e) {
    if (e.code !== 'ENOTDIR') {
      console.error(e)
    }
  }
}
