import { program } from 'commander'
import { command } from '../command'
import build from '@saulx/aristotle-build'
import { isAbsolute, join } from 'path'
import { writeJSON, copy, ensureDir, pathExists, writeFile } from 'fs-extra'

const resolvePath = (path: string): string => {
  if (!isAbsolute(path)) {
    path = join(process.cwd(), path)
  }
  return path
}

command(
  program
    .command('build-app')
    .description('Builds app into function')
    .requiredOption('-t, --target <target>', 'Target to build')
    .requiredOption('-d, --dest <dest>', 'Build Destination')
).action(async ({ target, dest }) => {
  target = resolvePath(target)
  dest = resolvePath(dest)
  const indexPath = join(dest, 'index.ts')
  const filesPath = join(dest, 'files.json')
  const headersPath = join(dest, 'headers.json')
  const pathsPath = join(dest, 'paths.json')
  const configPath = join(dest, 'based.config.js')
  const templatePath = join(__dirname, 'template.ts')
  const res = await build({
    entryPoints: [target],
    minify: true,
    platform: 'browser',
    production: true,
    gzip: false,
  })

  const { css = [], js = [], files = {} } = res
  const filesJson = {}
  const headersJson = {}
  const pathsJson = {
    css: css.map(({ url }) => url),
    js: js.map(({ url }) => url),
  }

  for (const key in files) {
    const file = files[key]
    filesJson[key] = file.contents.toString()
    headersJson[key] = {
      // do we actually need this?
      'Content-Length': String(file.contents.byteLength),
      'Content-Type': file.mime,
      // 'Content-Encoding': 'gzip',
      ETag: String(file.checksum),
    }
  }

  await ensureDir(dest)
  await Promise.all([
    pathExists(indexPath).then(
      (exists) => !exists && copy(templatePath, indexPath)
    ),
    writeJSON(filesPath, filesJson),
    writeJSON(headersPath, headersJson),
    writeJSON(pathsPath, pathsJson),
    writeFile(
      configPath,
      `module.exports = {
      name: '${dest.split('/').at(-1)}',
      observable: false,
    }`
    ),
  ])

  // printHeader(options, config)
  // const output: Logout = { data: [] }
  // const { token } = await getToken(config.cluster)
  // if (!token) {
  //   fail('Not logged in.', output, options)
  // }
  // const p = getBasedLocation(config.cluster)
  // await emptyDir(p)
  // const client = makeClient(config.cluster)
  // client.auth(token)
  // let spinner: ora.Ora
  // try {
  //   if (options.output === 'fancy') {
  //     spinner = ora('Logging out').start()
  //   }
  //   await client.call('logout', {
  //     token,
  //   })
  //   spinner && spinner.clear()
  //   if (options.output === 'fancy') {
  //     printEmptyLine()
  //     console.info(prefixSuccess + 'Logged out.')
  //   }
  //   process.exit(0)
  // } catch (err) {
  //   spinner && spinner.clear()
  //   options.debug && printError(err)
  //   fail('Error loggin out.', output, options)
  // }
})
