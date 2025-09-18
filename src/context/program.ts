import { dirname, resolve } from 'node:path'
import {
  abs,
  getBranch,
  getFile,
  isPathValid,
  resolveBasedFilePath,
} from '../shared/index.js'

export async function contextProgram(): Promise<Based.Context.Project> {
  let basedProject: Based.Context.Project = this.get('basedProject')
  let basedFile: Based.Context.Project = {}

  if (basedProject) {
    return basedProject
  }

  const {
    cluster,
    org,
    project,
    env,
    apiKey,
    file,
    envDiscoveryUrl,
    platformDiscoveryUrl,
  } = this.program.opts() as Based.Context.Project

  let { path, yes: skip } = this.program.opts() as Based.Context.GlobalOptions

  if (path && !isPathValid(path)) {
    throw new Error('Invalid path: no such file or directory.')
  }

  const files = resolveBasedFilePath(path || process.cwd())
  basedFile = await getFile(file ? [file] : files)
  const basedFilePath: string = abs(
    file || 'based.ts',
    resolve(path || process.cwd()),
  )

  path = dirname(basedFilePath)

  if (!basedProject) {
    if (
      (!basedFile || Object.keys(basedFile)?.length <= 1) &&
      (!org || !project || !env)
    ) {
      if (!skip) {
        this.print.warning(this.i18n('context.configurationFileNotFound'), true)

        const createBasedFile = await this.form.boolean(
          this.i18n('context.createBasedFile', basedFilePath),
        )

        this.put('globalOptions', { createBasedFile })

        this.print.pipe()
      }
    }
  }

  basedProject = {
    cluster: 'baseddb',
    ...basedFile,
    ...(cluster !== undefined && { cluster }),
    ...(org !== undefined && { org }),
    ...(project !== undefined && { project }),
    ...(env !== undefined && { env }),
    ...(apiKey !== undefined && { apiKey }),
    ...(file !== undefined && { file }),
    ...(envDiscoveryUrl !== undefined && { envDiscoveryUrl }),
    ...(platformDiscoveryUrl !== undefined && { platformDiscoveryUrl }),
  }

  let envLabel: string = basedProject.env

  if (basedProject?.env?.endsWith('#branch')) {
    basedProject.branch = {} as Based.Context.Project['branch']

    basedProject.branch.name = await getBranch(path)

    const envInfo = basedProject.env.split('/')
    const useDataFrom = envInfo.length === 2 ? envInfo[0] : null

    basedProject.branch.useDataFrom = useDataFrom
    envLabel += ` <reset><dim>(${basedProject.branch.name ?? ''})</dim></reset>`
  }

  if (Object.keys(basedProject).length > 2) {
    if (basedProject.file) {
      this.print.pipe(this.i18n('context.file', basedProject.file))
    }

    if (basedProject.cluster !== 'production') {
      this.print.pipe(this.i18n('context.cluster', basedProject.cluster))
    }

    this.print
      .pipe(this.i18n('context.org', basedProject.org))
      .pipe(this.i18n('context.project', basedProject.project))
      .pipe(this.i18n('context.env', envLabel))

    if (basedProject.apiKey) {
      this.print.pipe(
        this.i18n('context.apiKey', `${basedProject.apiKey.slice(0, 7)}...`),
      )
    }

    this.print.pipe()
  }

  this.put('globalOptions', { path })
  this.set('basedProject', basedProject)

  return basedProject
}
