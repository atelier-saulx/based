import fs from 'node:fs/promises'
import { styleText } from 'node:util'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { relative } from 'node:path'
import wait from '../src/utils/wait.js'
import { printSummary } from '../test/shared/test.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IGNORE_PATTERNS = new Set(['.perf'])

const args = process.argv.filter((arg) => {
  if (arg === 'stopOnFail') {
    global.stopOnCrash = true
    return false
  }
  return true
})

const repeat = args[2] && /^\d+$/.test(args[2]) ? Number(args[2]) : 1
const match = args
  .slice(repeat == 1 ? 2 : 3)
  .filter((a) => !['--perf', '--all', '--scn'].includes(a))
  .map((t) => t.replace('.js', '.ts'))

const testsToRun: any[] = []

const p = join(__dirname, '../test')

const walk = async (dir = p) => {
  const files = await fs.readdir(dir)
  const promises: any[] = []
  for (const f of files) {
    if (f.endsWith('.ts')) {
      const path = join(dir, f)
      if (match.length > 0) {
        const relPath = relative(p, path)
        for (const test of match) {
          if (
            // default: no IGNORE_PATTERNS
            !args.includes('--perf') &&
            !args.includes('--all') &&
            !args.includes('--scn') &&
            ([...IGNORE_PATTERNS].some((pattern) => f.includes(pattern)) ||
              relPath.includes('scenarios/'))
          ) {
            continue
          } else if (
            // .perf only
            args.includes('--perf') &&
            !f.includes('.perf')
          ) {
            continue
          } else if (
            // scenarios only
            args.includes('--scn') &&
            !relPath.includes('scenarios/')
          ) {
            continue
          }
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
        if (
          // default: no files containing IGNORE_PATTERNS and no scenarios/* files
          !args.includes('--perf') &&
          !args.includes('--all') &&
          !args.includes('--scn') &&
          ([...IGNORE_PATTERNS].some((pattern) => f.includes(pattern)) ||
            relative(p, path).includes('scenarios/'))
        ) {
          continue
        } else if (
          // .perf only
          args.includes('--perf') &&
          [...IGNORE_PATTERNS].some((pattern) => !f.includes('.perf'))
        ) {
          continue
        } else if (
          // scenarios only
          args.includes('--scn') &&
          !relative(p, path).includes('scenarios/')
        ) {
          continue
        }
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
