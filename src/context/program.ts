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
      this.print
        .warning(this.i18n('context.configurationFileNotFound'), true)
        .pipe()
    }
  }

  basedProject = {
    ...basedFile,
    ...(cluster !== undefined && { cluster }),
    ...(cluster === undefined &&
      basedFile.cluster === undefined && { cluster: 'production' }),
    ...(org !== undefined && { org }),
    ...(project !== undefined && { project }),
    ...(env !== undefined && { env }),
    ...(apiKey !== undefined && { apiKey }),
    ...(file !== undefined && { file }),
  }

  this.set('basedProject', basedProject)

  if (Object.keys(basedProject).length > 1) {
    this.print.info(
      this.i18n('context.file', basedProject.file),
      this.state.emojis.pipe,
    )

    if (basedProject.cluster !== 'production') {
      this.print.info(
        this.i18n('context.cluster', basedProject.cluster),
        this.state.emojis.pipe,
      )
    }

    this.print
      .info(this.i18n('context.org', basedProject.org), this.state.emojis.pipe)
      .info(
        this.i18n('context.project', basedProject.project),
        this.state.emojis.pipe,
      )
      .info(this.i18n('context.env', basedProject.env), this.state.emojis.pipe)

    if (basedProject.apiKey) {
      this.print.info(
        this.i18n('context.apiKey', `${basedProject.apiKey.slice(0, 7)}...`),
        this.state.emojis.pipe,
      )
    }

    this.print.pipe()
  }

  return basedProject
}
