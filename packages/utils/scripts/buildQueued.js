const fs = require('fs')
const { join } = require('path')

const full = []
const optional = []

const MAX_ARGS = 10

for (let i = MAX_ARGS; i > -1; i--) {
  for (let z = i === MAX_ARGS ? 0 : i; z < i + 1; z++) {
    let args = ''
    let bigArgs = ''
    let letter = 'a'.charCodeAt(0) - 1
    for (let j = 0; j < i; j++) {
      letter++
      const c = String.fromCharCode(letter)
      const C = c.toUpperCase()
      if (args.length) {
        args += ','
      }
      if (z > j) {
        args += `${c}:${C}`
      } else {
        args += `${c}?:${C}`
      }
      bigArgs += C + ','
    }
    const result = `function queued<${bigArgs}K>(
      promiseFn: (${args}) => Promise<K>,
      opts?: {
        concurrency?: number
        dedup?: (...args: any[]) => number | string
      }
    ): (${args}) => Promise<K>`
    if (z === i) {
      full.push(result)
    } else {
      optional.push(result)
    }
  }
}

console.info(full.reverse())

console.info('-----------')
console.info(optional)

// ${optional.join('\n')}

const file = `
// optional
${optional.join('\n')}

// full
${full.join('\n')}
`

fs.writeFileSync(join(__dirname, './queuedTypes.ts'), file)
