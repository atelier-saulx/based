import { getBasedFile } from '../../shared/getBasedFile.js'

export async function contextProgram(): Promise<Based.Context.Project> {
  let basedProject: Based.Context.Project = this.get('basedProject')
  let basedFile: Based.Context.Project = {}

  if (basedProject) {
    return basedProject
  }

  const { cluster, org, project, env, apiKey, file } =
    this.program.opts() as Based.Context.Project

  if (!basedProject) {
    basedFile = await getBasedFile(
      file ? [file] : ['based.json', 'based.js', 'based.ts'],
    )

    if (!basedFile || !Object.keys(basedFile)?.length) {
      this.print.warning(this.i18n('context.configurationFileNotFound'))
    }
  }

  basedProject = {
    ...basedFile,
    ...(cluster !== undefined && { cluster }),
    ...(org !== undefined && { org }),
    ...(project !== undefined && { project }),
    ...(env !== undefined && { env }),
    ...(apiKey !== undefined && { apiKey }),
    ...(file !== undefined && { file }),
  }

  this.set('basedProject', basedProject)

  this.print
    .info(this.i18n('context.file', basedProject.file))
    .info(this.i18n('context.org', basedProject.org))
    .info(this.i18n('context.project', basedProject.project))
    .info(this.i18n('context.env', basedProject.env))

  return basedProject
}
