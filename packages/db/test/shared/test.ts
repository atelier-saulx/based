import picocolors from 'picocolors'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { perf } from '../../benchmarks/utils.js'

export const counts = {
  errors: 0,
  skipped: 0,
  success: 0,
}

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'

const test = async (name: string, fn: (t?: any) => Promise<void>) => {
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
    tmp: resolve(join(__dirname, relativePath)),
  }
  try {
    const end = perf(name, 'test-results.csv')
    await fn(t)
    end()
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
      (err.stack ?? err.msg)
        .replaceAll('.js', '.ts')
        .replaceAll('/dist/', '/')
        .replace('Error: ', '\n') + '\n'
    console.log(picocolors.red(msg))
  }

  await Promise.all(afters.map((f) => f()))
}

test.skip = async (name: string, fn: (t?: any) => Promise<void>) => {
  counts.skipped++
  console.log('')
  console.log(picocolors.gray('skip ' + name))
}

export const printSummary = () => {
  const nuno =
    Math.random() * 10 > 8
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

  const msg =
    // nuno +
    `
Test result:
Errors: ${counts.errors}
Skipped: ${counts.skipped}
Good: ${counts.success}        
`

  if (counts.errors > 0) {
    console.log(picocolors.red(msg))
  } else if (counts.success) {
    console.log(picocolors.green(msg))
  } else {
    console.log(picocolors.gray(msg))
  }
}

export default test
