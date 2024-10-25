import os from 'node:os'
import { execSync } from 'node:child_process'
import { packageDirectorySync } from 'pkg-dir'
import { readFileSync, writeFileSync } from 'node:fs'

const getUser = () => {
  const hostname = os.hostname()
  const platform = os.platform()
  const release = os.release()
  const arch = os.arch()
  const cores = os.cpus().length
  const memory = (os.totalmem() / 1024 ** 3).toFixed(2) // Memory in GB

  return `${hostname}-${platform}${release}-${arch}-${cores}cores-${memory}GB`
}

const getCommit = () => {
  return execSync('git rev-parse --short HEAD').toString().trim()
}

const files: Record<string, File> = {}

let info: {
  pcommit: string
  user: string
  dir: string
}

const getFile = (name: string): File => {
  if (!(name in files)) {
    if (!info) {
      info = {
        pcommit: getCommit(),
        user: getUser(),
        dir: packageDirectorySync(),
      }
    }

    try {
      const csv = readFileSync(name).toString()
      const split = csv.split('\n')
      const headers = split[0].split(',')

      if (headers.length > 2) {
        const id = `${info.pcommit},${info.user}`
        let i = split.length
        let current
        let prefix = ''
        let affix = ''

        while (--i) {
          const line = split[i]
          if (current) {
            prefix = `${line}\n${prefix}`
          } else if (line.startsWith(id)) {
            current = line.split(',')
          } else {
            affix = `${line}\n${affix}`
          }
        }

        if (!current) {
          prefix = affix
          affix = ''
          current = Array.from({ length: headers.length }).fill('')
          current[0] = info.pcommit
          current[1] = info.user
        }

        // parse csv
        files[name] = {
          name,
          prefix,
          affix,
          headers,
          current,
        }
      }
    } catch (e) {}

    files[name] ??= {
      name,
      prefix: '',
      affix: '',
      headers: ['pcommit', 'user'],
      current: [info.pcommit, info.user],
    }

    console.log(files[name])
  }
  return files[name]
}

const updateFile = (file: File) => {
  const csv =
    file.headers.join(',') +
    '\n' +
    file.prefix +
    file.current.join(',') +
    file.affix
  writeFileSync(file.name, csv)
}

type File = {
  name: string
  prefix: string
  affix: string
  headers: string[]
  current: string[]
}

export const perf = (label, filename = 'results.csv') => {
  const start = Date.now()

  return () => {
    const end = Date.now()
    const res = (end - start) / 1e3 + 's'
    // const row = [info.pcommit, info.user, (end - start) / 1e3 + 's']
    const file = getFile(filename)
    const index = file.headers.indexOf(label)

    if (index === -1) {
      file.headers.push(label)
      file.current.push(res)
    } else {
      file.current[index] = res
    }

    updateFile(file)
  }
}
