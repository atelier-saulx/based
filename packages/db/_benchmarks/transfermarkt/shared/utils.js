import { dirname, join } from 'path/posix'
import { fileURLToPath } from 'url'

export const __dirname = dirname(fileURLToPath(import.meta.url))
export const tmpDir = join(__dirname, 'tmp')
export const dir = join(tmpDir, 'transfermarkt').replace(
  '/dist/test/',
  '/test/',
)
let label
export const log = console.log
export const time = (l) => console.time((label = l))
export const timeEnd = () => console.timeEnd(label)

export const num = (n) => {
  const str = String(n)
  let i = str.length
  let x = 0
  let res = ''
  while (i--) {
    if (!x || x % 3) {
      res = str[i] + res
    } else {
      res = str[i] + '.' + res
    }
    x++
  }
  return res
}
