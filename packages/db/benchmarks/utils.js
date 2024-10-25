import os from 'node:os'
import { execSync } from 'node:child_process'
import { packageDirectorySync } from 'pkg-dir'
import { readFileSync, writeFileSync } from 'node:fs'
import exitHook from 'exit-hook'

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

const getChangedFiles = (prevCommit, commit) => {
  try {
    const output = execSync(`git diff --name-only ${prevCommit} ${commit}`)
      .toString()
      .trim()
    return output ? output.split('\n') : [] // Split output into an array of file names
  } catch (error) {
    return []
  }
}

const cache = new Map()
const relevantFilesChanged = (prevCommit, commit) => {
  const id = prevCommit + commit
  if (cache.has(id)) {
    return cache.get(id)
  }
  const changed = getChangedFiles(prevCommit, commit)
  for (const change of changed) {
    if (!/(\.csv|\.json|\.md)$/.test(change)) {
      cache.set(id, true)
      return true
    }
  }
  cache.set(id, false)
}

const files = {}

let info

const getFile = (name) => {
  if (!(name in files)) {
    if (!info) {
      info = {
        commit: getCommit(),
        user: getUser(),
        dir: packageDirectorySync(),
      }
    }

    try {
      const csv = readFileSync(name).toString().trim()
      const split = csv.split('\n')
      const headers = split[0].split(',')

      if (headers.length > 3) {
        const id = `${info.commit},${info.user},`
        let i = split.length
        let prev
        let current
        let prefix = ''
        let affix = ''

        while (--i) {
          const line = split[i]
          if (current) {
            prev ??= line.split(',')
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
          current[0] = info.commit
          current[1] = info.user
          if (split.length > 1) {
            prev ??= split[split.length - 1].split(',')
          }
        }

        // parse csv
        files[name] = {
          name,
          prefix,
          affix,
          headers,
          prev,
          current,
        }
      }
    } catch (e) {}

    files[name] ??= {
      name,
      prefix: '',
      affix: '',
      headers: ['commit', 'user', 'modified'],
      current: [info.commit, info.user, ''],
    }
  }
  return files[name]
}

let hooked
const updateFile = (file) => {
  if (hooked) return
  exitHook(() => {
    file.current[2] = date()
    writeFileSync(
      file.name,
      file.headers.join(',') +
        '\n' +
        file.prefix +
        file.current.join(',') +
        file.affix,
    )
  })
}

const date = () => {
  return new Date().toISOString().slice(0, -5)
}

export const perf = (label, filename, res) => {
  if (typeof filename === 'number') {
    store(label, null, filename)
    return
  }
  if (typeof res === 'number') {
    store(label, filename, res)
  }
  const start = Date.now()

  return () => {
    const end = Date.now()
    const res = (end - start) / 1e3
    store(label, filename, res)
  }
}

const store = (label, filename, res) => {
  const file = getFile(filename || 'results.csv')
  const index = file.headers.indexOf(label)
  const prev = file.current[index] || file.prev?.[index]
  const prevCommit = file.prev?.[0]
  const commit = file.current[0]

  if (prev) {
    console.info(label, prev, '->', res)
  } else {
    console.info(label, res)
  }

  if (prevCommit && relevantFilesChanged(commit, '')) {
    return
  }

  if (!prevCommit || relevantFilesChanged(prevCommit, commit)) {
    if (index === -1) {
      file.headers.push(label)
      file.current.push(String(res))
    } else {
      file.current[index] = String(res)
    }
    updateFile(file)
  }
}
