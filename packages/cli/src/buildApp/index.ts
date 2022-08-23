import { fork } from 'child_process'
import path from 'path'
import { program } from 'commander'
import { command, GlobalOptions } from '../command'
import { isAbsolute, join } from 'path'
import { writeJSON, copy, ensureDir, pathExists, writeFile } from 'fs-extra'
import {
  fail,
  fitLines,
  prefixError,
  prefixSuccess,
  prefixWarn,
  printAction,
  printEmptyLine,
  printError,
  printHeader,
} from '../tui'
import { BuildResult } from '@saulx/aristotle-types'
import ora from 'ora'
import { GenericOutput } from '../types'
import chalk from 'chalk'

export type BuildAppOptions = GlobalOptions & {
  target: string
  dest: string
}

type BuildAppOutput = GenericOutput & {
  data: {
    target: string
    dest: string
    messages?: string
    errors?: any[]
  }
}

const resolvePath = (path: string): string => {
  if (!isAbsolute(path)) {
    path = join(process.cwd(), path)
  }
  return path
}

command(
  program
    .command('build-app')
    .description('Builds app into a data function')
    .requiredOption('-t, --target <target>', 'Target to build')
    .requiredOption('-d, --dest <dest>', 'Build Destination')
).action(async (options: BuildAppOptions) => {
  printHeader(options)
  options.output === 'fancy' && printAction('Build app')

  const target = resolvePath(options.target)
  const dest = resolvePath(options.dest)
  const indexPath = join(dest, 'index.ts')
  const filesPath = join(dest, 'files.json')
  const headersPath = join(dest, 'headers.json')
  const pathsPath = join(dest, 'paths.json')
  const configPath = join(dest, 'based.config.js')
  const templatePath = join(__dirname, 'template.ts')

  const output: BuildAppOutput = { data: { target, dest } }

  let spinner: ora.Ora

  if (options.output === 'fancy') {
    spinner = ora('Building app').start()
  }

  let res: BuildResult
  try {
    res = await new Promise((resolve, _reject) => {
      const child = fork(path.join(__dirname, 'child.js'), [target], {
        silent: true,
      })
      let res: BuildResult
      child.stderr.on('data', (chunk) => {
        output.data.messages = output.data.messages || ''
        output.data.messages += chunk.toString()
      })
      child.stdout.on('data', (chunk) => {
        output.data.messages = output.data.messages || ''
        output.data.messages += chunk.toString()
      })
      child.on('message', (message: BuildResult) => {
        res = message
        resolve(res)
      })
    })
  } catch (error) {
    spinner && spinner.stop()
    options.debug && printError(error)
    fail('Error building app', output, options)
  }
  spinner && spinner.stop()

  if (res.errors.length) {
    output.data.errors = res.errors
    if (options.output === 'fancy') {
      fitLines(output.data.messages, prefixError)
    }
    fail('Error building app', output, options)
  }
  if (output.data.messages && options.output === 'fancy') {
    fitLines(output.data.messages, prefixWarn)
    printEmptyLine()
  }

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

  if (options.output === 'fancy') {
    spinner = ora('Saving files').start()
  }

  try {
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
  } catch (error) {
    spinner && spinner.stop()
    options.debug && printError(error)
    fail('Error saving files', output, options)
  }
  spinner && spinner.stop()
  if (options.output === 'fancy') {
    printEmptyLine()
    console.info(
      prefixSuccess + 'Built app in folder ' + chalk.blue(options.dest) + '.'
    )
  } else if (options.output === 'json') {
    console.info(JSON.stringify(output, null, 2))
  }
})
