import { spawn } from 'child_process'
import { unlinkSync } from 'fs'
import tmp from 'tmp-promise'
import { dirname, join as pathJoin } from 'node:path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

export default class CC {
  #tmpFile: string = tmp.tmpNameSync({
    tmpdir: __dirname,
    template: pathJoin(__dirname, `tmp-XXXXXX`),
  })

  async compile(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cc = spawn('gcc', ['-xc', '-', '-o', this.#tmpFile])

      cc.stdin.end(source)
      cc.stderr.on('data', (data: Buffer) => {
        const str = data.toString('utf8')

        if (!str.includes('#pragma')) {
          console.error(data.toString('utf8'))
        }
      })
      cc.on('close', (code) => {
        if (code !== 0) {
          return reject(`gcc failed with: ${code}`)
        }
        resolve()
      })
    })
  }

  run(input?: Buffer, outputEncoding?: 'hex' | 'utf8'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let out = ''
      let prg

      try {
        prg = spawn(this.#tmpFile)
      } catch (err) {
        return reject(err)
      }

      if (input) {
        prg.stdin.write(input)
        prg.stdin.end()
      }

      prg.stdout.on('data', (data: Buffer) => {
        out += data.toString('utf8')
      })
      prg.stderr.on('data', (data: Buffer) => {
        console.error(data.toString('utf8'))
      })
      prg.on('close', (code, signal) => {
        if (code !== 0) {
          if (code !== null) {
            reject(`Failed with code ${code}`)
          } else {
            reject(`Received signal ${signal}`)
          }
          return
        }
        resolve(Buffer.from(out, outputEncoding || 'hex'))
      })
    })
  }

  clean() {
    try {
      unlinkSync(this.#tmpFile)
    } catch (err) {}
  }
}
