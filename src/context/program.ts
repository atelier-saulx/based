import { getFile } from '../shared/getFile.js'

export async function contextProgram(): Promise<Based.Context.Project> {
  let basedProject: Based.Context.Project = this.get('basedProject')
  let basedFile: Based.Context.Project = {}

  if (basedProject) {
    return basedProject
  }

  const { cluster, org, project, env, apiKey, file } =
    this.program.opts() as Based.Context.Project

  if (!basedProject) {
    basedFile = await getFile(
      file ? [file] : ['based.ts', 'based.json', 'based.js'],
    )

    if (!basedFile || !Object.keys(basedFile)?.length) {
      this.print.warning(this.i18n('context.configurationFileNotFound'), true)

      const createBasedFile = await this.form.boolean({
        message: this.i18n('context.createBasedFile', process.cwd()),
      })

      this.put('globalOptions', { createBasedFile })

      this.print.pipe()
    }
  }

  basedProject = {
    cluster: 'production',
    ...basedFile,
    ...(cluster !== undefined && { cluster }),
    ...(org !== undefined && { org }),
    ...(project !== undefined && { project }),
    ...(env !== undefined && { env }),
    ...(apiKey !== undefined && { apiKey }),
    ...(file !== undefined && { file }),
  }

  this.set('basedProject', basedProject)

  if (Object.keys(basedProject).length > 1) {
    this.print.pipe(this.i18n('context.file', basedProject.file))

    if (basedProject.cluster !== 'production') {
      this.print.pipe(this.i18n('context.cluster', basedProject.cluster))
    }

    this.print
      .pipe(this.i18n('context.org', basedProject.org))
      .pipe(this.i18n('context.project', basedProject.project))
      .pipe(this.i18n('context.env', basedProject.env))

    if (basedProject.apiKey) {
      this.print.pipe(
        this.i18n('context.apiKey', `${basedProject.apiKey.slice(0, 7)}...`),
      )
    }

    this.print.pipe()
  }

  return basedProject
}
