import { styleText } from 'node:util'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import {
  BasedDb,
  DbClient,
  DbServer,
  getDefaultHooks,
} from '../../src/index.js'
import { deepEqual } from './assert.js'
import { wait } from '../../src/utils/index.js'
import fs from 'node:fs/promises'

export const counts = {
  errors: 0,
  skipped: 0,
  success: 0,
}

const dirSize = async (directory) => {
  const files = await fs.readdir(directory)
  const stats = files.map((file) => fs.stat(join(directory, file)))
  return (await Promise.all(stats)).reduce(
    (accumulator, { size }) => accumulator + size,
    0,
  )
}

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'

const errorFiles = new Set<string>()
const errors = new Set<string>()

export type T = {
  after: (fn: () => Promise<void> | void, push?: boolean) => void
  backup: (db: DbServer) => Promise<void>
  tmp: string
}

const test: {
  (name: string, fn: (t: T) => Promise<void>): Promise<any>
  skip(name: string, fn: (t: T) => Promise<void>): undefined
} = async (name: string, fn: (t: T) => Promise<void>): Promise<any> => {
  if (
    process.env.TEST_TO_RUN &&
    !name.toLowerCase().includes(process.env.TEST_TO_RUN.toLowerCase())
  ) {
    counts.skipped++
    console.log('')
    console.log(styleText('gray', 'skip ' + name))
    return
  }

  process.env.TEST_NAME = name

  let hasErrored = false
  console.log(styleText('gray', `\nstart ${name}`))
  const d = performance.now()
  const afters: any[] = []
  const t: T = {
    after: (fn: () => Promise<void> | void, push?: boolean) => {
      if (push) {
        afters.push(fn)
      } else {
        afters.unshift(fn)
      }
    },
    backup: async (db: DbServer) => {
      afters.push(async () => {
        try {
          await db.destroy()
        } catch (err) {}
      })

      if (hasErrored) {
        return
      }

      const make = async (db: DbServer) => {
        const client = new DbClient({
          hooks: getDefaultHooks(db),
        })
        const checksums: any[] = []
        const data: any[] = []
        const counts: any[] = []

        for (const type in db.schema?.types) {
          let x = await client.query(type).include('*', '**').get()
          checksums.push(x['checksum'])
          data.push(x)
          counts.push((await client.query(type).count().get()).count)
        }

        return [checksums, data, counts]
      }

      const [checksums, a, counts] = await make(db)

      let d = performance.now()
      await db.save()
      console.log(styleText('gray', `saved db ${performance.now() - d} ms`))

      const size = await dirSize(t.tmp)
      const strSize =
        size < 1_048_576
          ? `${Math.ceil(size / 1024)} kiB`
          : `${Math.ceil(size / 1_048_576)} MiB`
      console.log(styleText('gray', `backup size ${strSize}`))

      await db.stop()

      const newDb = new DbServer({
        path: t.tmp,
      })

      afters.push(async () => {
        try {
          await newDb.destroy()
        } catch (err) {}
      })

      d = performance.now()
      await newDb.start()
      console.log(
        styleText('gray', `started from backup ${performance.now() - d} ms`),
      )

      const [backupChecksums, b, c] = await make(newDb)
      // console.dir(b, { depth: null })
      if (a.length === b.length) {
        function findFirstDiffPos(a, b) {
          for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return i
          }
          return -1
        }
        const di = findFirstDiffPos(checksums, backupChecksums)
        if (di >= 0) {
          deepEqual(
            b[di],
            a[di],
            `Mismatch after backup (len:${b.length}) ${Object.keys(db.schema!.types)[di]}`,
          )
        }
        const ci = findFirstDiffPos(counts, c)
        if (ci >= 0) {
          deepEqual(
            c[ci],
            counts[ci],
            `Mismatching count after backup (len:${b.length}) ${Object.keys(db.schema!.types)[ci]}`,
          )
        }
      }

      await wait(10)
    },
    tmp: resolve(join(__dirname, relativePath)),
  }

  process.env.TEST_FILENAME = global._currentTestPath
  process.env.TEST_TMP_DIR = t.tmp

  try {
    await fn(t)
    counts.success++
    console.log(
      styleText('green', `✓ ${name}`),
      styleText(
        'gray',
        `${Math.round((performance.now() - d) * 100) / 100} ms`,
      ),
    )
  } catch (err) {
    hasErrored = true
    counts.errors++
    console.log(
      styleText('red', `! ${name}`),
      styleText(
        'gray',
        `${Math.round((performance.now() - d) * 100) / 100} ms`,
      ),
    )
    err =
      err instanceof Error ? err : new Error(`err is not an Error: '${err}'`)
    const msg =
      (err.stack || err.msg || err.message || err)
        .replace(/\.js(?=\s|$)/g, '.ts')
        .replaceAll('/dist/', '/')
        .replace('Error: ', '\n') + '\n'
    console.log(styleText('red', msg))
    errors.add(`${global._currentTestPath} (${name}):\n${msg}`)

    const x = global._currentTestPath.split('/')
    errorFiles.add(`${x[x.length - 1]}`)

    if (global.stopOnCrash) {
      process.exit(1)
    }
  }

  try {
    const errs: any[] = []
    for (let i = 0; i < afters.length; i++) {
      try {
        await afters[i]()
      } catch (err) {
        errs.push(err)
      }
    }
    if (errs.length > 0) {
      throw errs[0]
    }
  } catch (err) {
    counts.errors++
    console.log(
      styleText('red', `! ${name}`),
      styleText(
        'gray',
        `${Math.round((performance.now() - d) * 100) / 100} ms`,
      ),
    )

    const msg =
      (err.stack || err.msg || err.message || err)
        .replace(/\.js(?=\s|$)/g, '.ts')
        .replaceAll('/dist/', '/')
        .replace('Error: ', '\n') + '\n'
    console.log(styleText('red', msg))
    errors.add(`${global._currentTestPath} (${name}):\n${msg}`)
  }
}

test.skip = (name: string, fn: (t: T) => Promise<void>): undefined => {
  counts.skipped++
  console.log('')
  console.log(styleText('gray', 'skip ' + name))
}

export const printSummary = (): undefined => {
  const nuno =
    Math.random() * 100 > 98
      ? `
                                  ░██░
                           ▓█████████████▒
                      ▓▓██████████████████░
                    ▓██████████████████████▒░
                  ███████████████████████████░
                ░██████████████▓▒▒▒░░░░░░░▓██▒
                ███████████▓▓▒▒░░░░          ▒░
              ▒███████████▓▒▒░░░░░            ░▓
             ░███████████▓▒▒░░░░               ░░
             ░███████████▒▒░░░░                 ░
              ▒█████████▓▒▒░░░░
               ████████▓▒▒░░░░░░░░
                ████▓▓▓▒▒░▒▒▒▓██████▓▒░     ░▒▒░▒░
                 █▓▓▓██▓▓▓▓█  ░ ░▒▒▓░░▓▒█░▒▒░░▒░  ░▒▓
                 ▒█████▓▓▒▓▓  ▒ ░▓░░ ░▓█▓  ▒
                 ░░▒▒░░░░░░░▒░░░      ░█▒░
                  ░░░░▒░░░░░░▒░      ░▓█▒░
                  ░▓▒░▓▒░░░░░░▒▒░░░ ░▒▓▓▒░
                   ▒▓██▓▒░░░░░░       ▓░░░
                    ▒████▒░░░░░      ░▓██░ ▒▓░
                     ▓████▓▒░░░░░░▓██████▓▒▒███▓░
                     ░███████▓▓███████▒▒░   ░▒███▓
                      ██████████████▒░░▒░     ████░
                    █████████████████▓███▓▒  ▒████
                  ▓████████████████████████░░▓███▓
                 ▒██████████████████████████▓▓██▓░
                ░████████████████████████▓▒░░▒▒▒▓███████▒░
               ░██████████████████████▓▒▒▒░ ░░▒▓████████████▓
              ▒████▓▓▓██▓▓███████████▓▒░▒  ░░░▒▒▓███████████████▒
           ▒████████▒▒▓▓▒▒░░▒███████████▒▒░▒▒▓▓▒▓██████████████████
        ▒███████████░░░░░░░░░░░░▒▓█████▓▒▒▒▒▒░░░████████████████████▓
     ▓██████████████▒░░            ░▒░▒▒░░░▒▒▒▒▒██████████████████████░
  ███████████████████                    ▓█████████████████████████████▓
██████████████████████                  ████████████████████████████████
███████████████████████                █████████████████████████████████
█████████████████████████               ████████████████████████████████
███████████████████████████             ▒███████████████████████████████
███████████████████████████              ███████████████████████████████
█████████████████████████▓               ░██████████████████████████████
`
      : ''

  let msg =
    nuno +
    `
Test result:
Errors: ${counts.errors}
Skipped: ${counts.skipped}
Good: ${counts.success}
`

  if (counts.errors > 0) {
    if (!process.env.TEST_TO_RUN) {
      msg = `Files: \n${Array.from(errorFiles)
        .map((v) => '  ' + v)
        .join('\n')}\n${msg}`
    }
    console.log(styleText('red', msg))
  } else if (counts.success) {
    console.log(styleText('green', msg))
  } else {
    console.log(styleText('gray', msg))
  }
}

export default test
