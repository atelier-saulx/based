import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import picocolors from 'picocolors'
import { wait } from '@saulx/utils'

import { printSummary } from '../dist/test/shared/test.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv

const match = args.slice(2)

const testsToRun = []

const p = join(__dirname, '../dist/test')

await fs.readdir(p).then((files) => {
  for (const f of files) {
    if (f.endsWith('.js')) {
      if (match.length > 0) {
        for (const test of match) {
          if (test.includes(':')) {
            const [a, b] = test.split(':')
            if (f.toLowerCase().includes(a.slice(1).toLowerCase())) {
              testsToRun.push([f, b])
              break
            }
          } else if (test.startsWith('^')) {
            if (!f.toLowerCase().includes(test.slice(1).toLowerCase())) {
              testsToRun.push([f])
              break
            }
          } else if (f.toLowerCase().includes(test.toLowerCase())) {
            testsToRun.push([f])
            break
          }
        }
      } else {
        testsToRun.push([f])
      }
    }
  }
})

console.log('\n\n')
console.log(
  picocolors.bgWhite(
    ` RUN ${testsToRun.length} file${testsToRun.length == 1 ? '' : 'S'} `,
  ),
)
console.log('')

for (const test of testsToRun) {
  const fullPath = join(p, test[0])

  console.log(picocolors.bgBlue(` ${test[0]} `))

  if (test[1]) {
    process.env.TEST_TO_RUN = test[1]
  } else {
    process.env.TEST_TO_RUN = ''
  }

  await import(fullPath)
    .catch((err) => {
      console.log('')
      console.log(picocolors.bgRed(` Err: ${test[0]} `))
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
