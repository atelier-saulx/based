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
      this.print.warning(
        `No <b>Based</b> configuration file found or is empty. <b>It is recommended to create one.</b>`,
      )
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
    .info(`<dim>Project file:</dim> <b>${basedProject.file}</b>`)
    .info(`<dim>Org:</dim> <b>${basedProject.org}</b>`)
    .info(`<dim>Project:</dim> <b>${basedProject.project}</b>`)
    .info(`<dim>Env:</dim> <b>${basedProject.env}</b>`)

  return basedProject
}
