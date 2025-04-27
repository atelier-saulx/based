import picocolors from 'picocolors'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { BasedDb, bufToHex } from '../../src/index.js'
import { deepEqual } from './assert.js'
import { wait } from '@saulx/utils'
import { drawDot } from '../../src/server/csmt/index.js'
import { CsmtNodeRange } from '../../src/server/tree.js'

export const counts = {
  errors: 0,
  skipped: 0,
  success: 0,
}

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'

const errorFiles = new Set<string>()
const errors = new Set<string>()

const test = async (
  name: string,
  fn: (t?: any) => Promise<void>,
): Promise<any> => {
  if (
    process.env.TEST_TO_RUN &&
    !name.toLowerCase().includes(process.env.TEST_TO_RUN.toLowerCase())
  ) {
    counts.skipped++
    console.log('')
    console.log(picocolors.gray('skip ' + name))
    return
  }
  let hasErrored = false
  console.log(picocolors.gray(`\nstart ${name}`))
  const d = performance.now()
  const afters = []
  const t = {
    after: (fn) => {
      afters.push(fn)
    },
    backup: async (db: BasedDb) => {
      afters.push(async () => {
        try {
          await db.destroy()
        } catch (err) {}
      })

      if (hasErrored) {
        return
      }

      const fields = ['*', '**']
      const make = async (db) => {
        const checksums = []
        const data = []

        for (const type in db.server.schema.types) {
          let x = await db.query(type).include(fields).get()
          checksums.push(x.checksum)
          data.push(x.toObject())
        }

        return [checksums, data]
      }

      const [checksums, a] = await make(db)

      let d = Date.now()

      await db.save()

      const oldCsmt = db.server.merkleTree

      await db.stop()

      console.log(picocolors.gray(`saved db ${Date.now() - d} ms`))

      const newDb = new BasedDb({
        path: t.tmp,
      })

      afters.push(async () => {
        try {
          await newDb.destroy()
        } catch (err) {}
      })
      d = Date.now()
      await newDb.start()
      console.log(picocolors.gray(`started from backup ${Date.now() - d} ms`))

      const [backupChecksums, b] = await make(newDb)
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
            `Mismatch after backup (len:${b.length}) ${Object.keys(db.server.schema.types)[di]}`,
          )
        }
      }

      // console.dir({ a, b }, { depth: null })

      deepEqual(checksums, backupChecksums, 'Starting from backup is equal')

      const newCsmt = newDb.server.merkleTree
      const prettier = (key: any, value: any) => {
        if (key === 'hash') {
          return bufToHex(value)
        } else {
          return value
        }
      }
      const fmtNodeData = (data: CsmtNodeRange) =>
        `type: ${data?.typeId}\nstart: ${data?.start} end: ${data?.end}`
      //console.log(JSON.stringify(oldCsmt, prettier, 2), JSON.stringify(newCsmt.getRoot(), prettier, 2), 'csmt')
      //console.log('old', drawDot(oldCsmt, fmtNodeData))
      //console.log('new', drawDot(newCsmt, fmtNodeData))
      //deepEqual(oldCsmt.getRoot(), newCsmt.getRoot(), 'csmt trees')
      deepEqual(oldCsmt.getRoot().hash, newCsmt.getRoot().hash, 'csmt hash')

      await wait(10)
    },
    tmp: resolve(join(__dirname, relativePath)),
  }

  try {
    await fn(t)
    counts.success++
    console.log(
      picocolors.green(`✓ ${name}`),
      picocolors.gray(`${Math.round((performance.now() - d) * 100) / 100} ms`),
    )
  } catch (err) {
    hasErrored = true
    counts.errors++
    console.log(
      picocolors.red(`! ${name}`),
      picocolors.gray(`${Math.round((performance.now() - d) * 100) / 100} ms`),
    )
    const msg =
      (err.stack ?? err.msg ?? err)
        .replace(/\.js(?=\s|$)/g, '.ts')
        .replaceAll('/dist/', '/')
        .replace('Error: ', '\n') + '\n'
    console.log(picocolors.red(msg))
    errors.add(`${global._currentTestPath} (${name}):\n${msg}`)

    const x = global._currentTestPath.split('/')
    errorFiles.add(`${x[x.length - 1]}`)

    if (global.stopOnCrash) {
      process.exit(1)
    }
  }

  try {
    const errs = []
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
      picocolors.red(`! ${name}`),
      picocolors.gray(`${Math.round((performance.now() - d) * 100) / 100} ms`),
    )

    const msg =
      (err.stack ?? err.msg ?? err)
        .replace(/\.js(?=\s|$)/g, '.ts')
        .replaceAll('/dist/', '/')
        .replace('Error: ', '\n') + '\n'
    console.log(picocolors.red(msg))
    errors.add(`${global._currentTestPath} (${name}):\n${msg}`)
  }
}

test.skip = async (name: string, fn: (t?: any) => Promise<void>) => {
  counts.skipped++
  console.log('')
  console.log(picocolors.gray('skip ' + name))
}

export const printSummary = () => {
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
    console.log(picocolors.red(msg))
  } else if (counts.success) {
    console.log(picocolors.green(msg))
  } else {
    console.log(picocolors.gray(msg))
  }
}

export default test
