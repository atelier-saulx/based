import picocolors from 'picocolors'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { BasedDb } from '../../src/index.js'
import { deepEqual } from './assert.js'
import { wait } from '@saulx/utils'

export const counts = {
  errors: 0,
  skipped: 0,
  success: 0,
}

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
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
  console.log(picocolors.gray(`\nstart ${name}`))
  const d = performance.now()
  const afters = []
  const t = {
    after: (fn) => {
      afters.push(fn)
    },
    backup: async (db: BasedDb) => {
      const checksums = []

      for (const type in db.server.schema.types) {
        const x = await db.query(type).include('*', '**').get()
        checksums.push(x.checksum)
      }

      await db.stop()
      const newDb = new BasedDb({
        path: t.tmp,
      })
      await newDb.start()

      const backupChecksums = []

      for (const type in newDb.server.schema.types) {
        const x = await newDb.query(type).include('*', '**').get()
        backupChecksums.push(x.checksum)
      }

      deepEqual(checksums, backupChecksums, 'Starting from backup is equal')

      await wait(10)
      await newDb.destroy()
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

  try {
    await Promise.all(afters.map((f) => f()))
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
      // msg = `Failed tests: \n${Array.from(errors).join('\n\n')}\n${msg}`
    }
    console.log(picocolors.red(msg))
  } else if (counts.success) {
    console.log(picocolors.green(msg))
  } else {
    console.log(picocolors.gray(msg))
  }
}

export default test
