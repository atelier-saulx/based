import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import picocolors from 'picocolors'
import { wait } from '@saulx/utils'

import { printSummary } from '../dist/test/shared/test.js'
import { relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv

const match = args.slice(2)

const testsToRun = []

const p = join(__dirname, '../dist/test')

const walk = async (dir = p) => {
  const files = await fs.readdir(dir)
  const promises = []

  for (const f of files) {
    if (f.endsWith('.js')) {
      if (match.length > 0) {
        for (const test of match) {
          if (test.includes(':')) {
            const [a, b] = test.split(':')
            if (f.toLowerCase().includes(a.slice(1).toLowerCase())) {
              testsToRun.push([join(dir, f), b])
              break
            }
          } else if (test.startsWith('^')) {
            if (!f.toLowerCase().includes(test.slice(1).toLowerCase())) {
              testsToRun.push([join(dir, f)])
              break
            }
          } else if (f.toLowerCase().includes(test.toLowerCase())) {
            testsToRun.push([join(dir, f)])
            break
          }
        }
      } else {
        testsToRun.push([join(dir, f)])
      }
    } else if (f[0] !== '.' && f !== 'shared' && f !== 'tmp') {
      promises.push(walk(join(dir, f)).catch(() => {}))
    }
  }

  return Promise.all(promises)
}

await walk(p)

console.log('\n\n')
console.log(
  picocolors.bgWhite(
    ` RUN ${testsToRun.length} file${testsToRun.length == 1 ? '' : 's'} `,
  ),
)
console.log('')

for (const test of testsToRun) {
  const fullPath = test[0]
  const relPath = relative(p, fullPath)
  console.log(picocolors.bgBlue(` ${relPath} `))

  if (test[1]) {
    process.env.TEST_TO_RUN = test[1]
  } else {
    process.env.TEST_TO_RUN = ''
  }

  await import(fullPath)
    .catch((err) => {
      console.log('')
      console.log(picocolors.bgRed(` Err: ${relPath} `))
      console.error(err)
    })
    .then(() => {
      //   console.log('')
      //   console.log(picocolors.bgGreen(` 👌 ${test} `))
    })

  console.log('\n')

  await wait(0)
}

printSummary()
