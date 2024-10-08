import { getBasedFile } from '../../shared/getBasedFile.js'

export async function contextProgram(): Promise<BasedCli.Context.Project> {
  let basedProject: BasedCli.Context.Project = this.get('basedProject')
  let basedFile: BasedCli.Context.Project = {}

  if (basedProject) {
    return basedProject
  }

  const { cluster, org, project, env, apiKey } =
    this.program.opts() as BasedCli.Context.Project

  if (!basedProject) {
    basedFile = await getBasedFile()

    if (!basedFile || !Object.keys(basedFile)?.length) {
      this.print.warning(
        `No <b>'based.json'</b> configuration file found or is empty. <b>It is recommended to create one.</b>`,
      )
    }
  }

  basedProject = {
    ...basedFile,
    ...(cluster && { cluster }),
    ...(org && { org }),
    ...(project && { project }),
    ...(env && { env }),
    ...(apiKey && { apiKey }),
  }

  this.set('basedProject', basedProject)

  this.print
    .info(`<dim>org:</dim> <b>${basedProject.org}</b>`)
    .info(`<dim>project:</dim> <b>${basedProject.project}</b>`)
    .info(`<dim>env:</dim> <b>${basedProject.env}</b>`)

  return basedProject
}
