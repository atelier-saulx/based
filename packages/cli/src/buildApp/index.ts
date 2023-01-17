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
    .option('-nm, --noMinification', 'Disable minification')
    .requiredOption('-t, --target <target>', 'Target to build')
    .requiredOption('-d, --dest <dest>', 'Build Destination')
).action(async ({ target, dest, noMinification }) => {
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
    minify: !noMinification,
    platform: 'browser',
    production: true,
    gzip: true,
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
    filesJson[key] = file.contents.toString('base64')
    headersJson[key] = {
      'Content-Type': file.mime,
      'Content-Encoding': 'gzip',
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
})
