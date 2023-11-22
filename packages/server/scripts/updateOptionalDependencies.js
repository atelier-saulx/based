const path = require('node:path')
const fs = require('node:fs')

const version = process.argv[2]
if (!version) {
  throw new Error('no version argument')
}
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
)

for (const name in pkg.optionalDependencies) {
  pkg.optionalDependencies[name] = version
}

fs.writeFileSync(
  path.join(__dirname, '..', 'package.json'),
  JSON.stringify(pkg, null, 2),
  'utf8'
)
