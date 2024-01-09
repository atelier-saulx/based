const path = require('node:path')
const fs = require('node:fs')
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(
  fileURLToPath(import.meta.url).replace('/dist/', '/')
)

const version = process.argv[2]
if (!version) {
  throw new Error('no version argument')
}
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
)

pkg.dependencies['@based/db-query'] = version

fs.writeFileSync(
  path.join(__dirname, '..', 'package.json'),
  JSON.stringify(pkg, null, 2),
  'utf8'
)
