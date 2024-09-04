import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import picocolors from 'picocolors'

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
          if (test.startsWith('^')) {
            if (!f.toLowerCase().includes(test.slice(1).toLowerCase())) {
              testsToRun.push(f)
              break
            }
          } else if (f.toLowerCase().includes(test.toLowerCase())) {
            testsToRun.push(f)
            break
          }
        }
      } else {
        testsToRun.push(f)
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
  const fullPath = join(p, test)

  await import(fullPath).catch((err) => {
    console.log('')
    console.log(picocolors.bgRed(` Err: ${test} `))
  })

  // .then(() => {
  //   console.log('')
  //   console.log(picocolors.bgGreen(` 👌 ${test} `))
  // })

  console.log('\n')
}
