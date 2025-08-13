import picocolors from 'picocolors'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { BasedDb } from '../../src/index.js'
import { deepEqual } from './assert.js'
import { wait, bufToHex } from '@based/utils'
import { destructureTreeKey, VerifTree } from '../../src/server/tree.js'
import fs from 'node:fs/promises'
import assert from 'node:assert'

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
    after: (fn: () => Promise<void> | void, push?: boolean) => {
      if (push) {
        afters.push(fn)
      } else {
        afters.unshift(fn)
      }
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
        const counts = []

        for (const type in db.server.schema?.types) {
          let x = await db.query(type).include(fields).get()
          checksums.push(x.checksum)
          data.push(x.toObject())
          counts.push(await db.query(type).count().get().toObject().$count)
        }

        return [checksums, data, counts]
      }

      const [checksums, a, counts] = await make(db)

      let d = performance.now()
      await db.save()
      console.log(picocolors.gray(`saved db ${performance.now() - d} ms`))

      const size = await dirSize(t.tmp)

      const kbs = ~~(size / 1024)
      if (kbs < 5000) {
        console.log(picocolors.gray(`backup size ${kbs}kb`))
      } else {
        console.log(picocolors.gray(`backup size ${~~(kbs / 1024)}mb`))
      }

      type MyBlockMap = {
        [key: number]: {
          key: number
          typeId: number
          start: number
          hash: string
        }
      }
      const oldBlocks: MyBlockMap = {}
      const newBlocks: MyBlockMap = {}
      const putBlocks = (verifTree: VerifTree, m: MyBlockMap) =>
        verifTree.foreachBlock(
          (block) =>
            (m[block.key] = {
              key: block.key,
              typeId: destructureTreeKey(block.key)[0],
              start: destructureTreeKey(block.key)[1],
              hash: bufToHex(block.hash),
            }),
        )
      putBlocks(db.server.verifTree, oldBlocks)

      await db.stop()

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
            `Mismatch after backup (len:${b.length}) ${Object.keys(db.server.schema.types)[di]}`,
          )
        }
        const ci = findFirstDiffPos(counts, c)
        if (ci >= 0) {
          deepEqual(
            c[ci],
            counts[ci],
            `Mismatching count after backup (len:${b.length}) ${Object.keys(db.server.schema.types)[ci]}`,
          )
        }
      }

      deepEqual(checksums, backupChecksums, 'Starting from backup is equal')

      putBlocks(newDb.server.verifTree, newBlocks)
      for (const k in oldBlocks) {
        deepEqual(oldBlocks[k], newBlocks[k])
      }
      for (const k in newBlocks) {
        deepEqual(newBlocks[k], oldBlocks[k])
      }

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
