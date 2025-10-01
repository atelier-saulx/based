export function contextGlobalOptions(): Based.Context.GlobalOptions<'skip'> {
  let globalOptions: Based.Context.GlobalOptions<'skip'> =
    this.get('globalOptions')

  const {
    yes: skip,
    display,
    path,
  } = this.program.opts() as Based.Context.GlobalOptions<'yes'>

  globalOptions = {
    ...globalOptions,
    ...(skip !== undefined && { skip }),
    ...(display !== undefined && { display }),
    ...(path !== undefined && { path }),
  }

  process.env.BASED_CLI_LOG_LEVEL = display

  this.set('globalOptions', globalOptions)

  return globalOptions
}
