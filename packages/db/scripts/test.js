import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

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
          if (f.toLowerCase().includes(test.toLowerCase())) {
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

for (const test of testsToRun) {
  const fullPath = join(p, test)
  await import(fullPath)
}
