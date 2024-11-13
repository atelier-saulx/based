export function contextGlobalOptions(): Based.Context.GlobalOptions<'skip'> {
  let globalOptions: Based.Context.GlobalOptions<'skip'> =
    this.get('globalOptions')

  if (globalOptions && Object.keys(globalOptions).length) {
    return globalOptions
  }

  const {
    yes: skip,
    display,
    cluster,
    org,
    project,
    env,
    apiKey,
    file,
  } = this.program.opts() as Based.Context.GlobalOptions<'yes'>

  globalOptions = {
    ...globalOptions,
    ...(skip !== undefined && { skip }),
    ...(display !== undefined && { display }),
    ...(cluster !== undefined && { cluster }),
    ...(org !== undefined && { org }),
    ...(project !== undefined && { project }),
    ...(env !== undefined && { env }),
    ...(apiKey !== undefined && { apiKey }),
    ...(file !== undefined && { file }),
  }

  this.set('globalOptions', globalOptions)

  return globalOptions
}
