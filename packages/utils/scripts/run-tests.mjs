import { execSync } from 'child_process'
import path from 'path'

const args = process.argv.slice(2)

let command = 'ava --verbose "dist/test/**/*.js"'

if (args.length > 0) {
  let specificFile = args[0]
  if (!path.extname(specificFile)) {
    specificFile += '.js'
  }
  const jsFile = specificFile.replace('.ts', '.js')
  command = `ava --verbose "dist/test/${jsFile}"`
}

console.log(`Running: ${command}`)
try {
  execSync(command, { stdio: 'inherit' })
} catch (error) {
  console.error(`Test run failed with code: ${error.status}`)
  process.exit(error.status || 1)
}
