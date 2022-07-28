import { program } from 'commander'
import { command } from '../command'
import build from '@saulx/aristotle-build'
import { isAbsolute, join } from 'path'
import { writeFile, ensureDir } from 'fs-extra'

const resolvePath = (path: string): string => {
  if (!isAbsolute(path)) {
    path = join(process.cwd(), path)
  }
  return path
}

console.log('WTF IS THIS?')

command(
  program
    .command('build-app')
    .description('Builds app into function')
    .requiredOption('-t, --target <target>', 'Target to build')
    .requiredOption('-d, --dest <dest>', 'Build Destination')
).action(async ({ target, dest }) => {
  console.log('SUCCESS')
  target = resolvePath(target)
  dest = resolvePath(dest)
  const res = await build({
    entryPoints: [target],
    minify: true,
    platform: 'browser',
    production: true,
    gzip: true,
  })
  const { css, js, files } = res
  const filesJson = {}
  const headersJson = {}
  for (const key in files) {
    const file = files[key]
    filesJson[key] = file.contents.toString()
    headersJson[key] = {
      // do we actually need this?
      'Content-Length': file.contents.byteLength,
      'Content-Type': file.mime,
      'Content-Encoding': 'gzip',
      ETag: file.checksum,
    }
  }

  console.log('---------->', js)

  await ensureDir(dest)
  await Promise.all([
    writeFile(join(dest, 'files.json'), JSON.stringify(filesJson, null, 2)),
    writeFile(join(dest, 'headers.json'), JSON.stringify(headersJson, null, 2)),
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
