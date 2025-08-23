import fs from 'node:fs/promises'
import { styleText } from 'node:util'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { wait } from '@based/utils'

import { printSummary } from '../dist/test/shared/test.js'
import { relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv

const stopOnCrashIndex = args.indexOf('stopOnFail')
global.stopOnCrash = stopOnCrashIndex != -1

const repeat = args[2] && /^\d+$/.test(args[2]) ? Number(args[2]) : 1

const match = args.slice(repeat == 1 ? 2 : 3)

const testsToRun = []

const p = join(__dirname, '../dist/test')

const walk = async (dir = p) => {
  const files = await fs.readdir(dir)
  const promises = []
  for (const f of files) {
    if (f.endsWith('.js')) {
      const path = join(dir, f)
      if (match.length > 0) {
        const relPath = relative(p, path)
        for (const test of match) {
          if (test.includes(':')) {
            const [a, b] = test.split(':')
            if (relPath.toLowerCase().includes(a.slice(1).toLowerCase())) {
              testsToRun.push([path, b])
              break
            }
          } else if (test.startsWith('^')) {
            if (!relPath.toLowerCase().includes(test.slice(1).toLowerCase())) {
              testsToRun.push([path])
              break
            }
          } else if (relPath.toLowerCase().includes(test.toLowerCase())) {
            testsToRun.push([path])
            break
          }
        }
      } else {
        testsToRun.push([path])
      }
    } else if (!f.includes('.') && f !== 'shared' && f !== 'tmp') {
      promises.push(walk(join(dir, f)).catch(() => {}))
    }
  }

  return Promise.all(promises)
}

await walk(p)

console.log('\n\n')
console.log(
  styleText(
    'bgWhite',
    ` RUN ${testsToRun.length} file${testsToRun.length == 1 ? '' : 's'} `,
  ),
)
console.log('')

let cnt = 0

for (let i = 0; i < repeat; i++) {
  if (repeat > 1) {
    console.log(`\n\nREPEAT ${i + 1}/${repeat}\n`)
  }

  for (const test of testsToRun) {
    const fullPath = test[0]
    const relPath = relative(p, fullPath)
    console.log(
      styleText(
        'bgBlue',
        ` ${styleText('bold', styleText('black', relPath))} `,
      ),
    )

    if (test[1]) {
      process.env.TEST_TO_RUN = test[1]
    } else {
      process.env.TEST_TO_RUN = ''
    }

    global._currentTestPath = fullPath
      .replace('/dist/', '/')
      .replace('.js', '.ts')

    await import(fullPath + `?_=${++cnt}`)
      .catch((err) => {
        console.log('')
        console.log(styleText('bgRed', ` Err: ${relPath} `))
        console.error(err)
      })
      .then(() => {})

    console.log('\n')

    await wait(0)
  }
}

if (repeat == 1) {
  printSummary()
} else {
  console.log(`\n\nRAN TESTS ${repeat} TIMES\n`)
}
