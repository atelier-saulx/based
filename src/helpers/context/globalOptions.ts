export function contextGlobalOptions(): Based.Context.GlobalOptions<'skip'> {
  let globalOptions: Based.Context.GlobalOptions<'skip'> =
    this.get('globalOptions')

  if (globalOptions && Object.keys(globalOptions).length) {
    return globalOptions
  }

  const { yes: skip, display } =
    this.program.opts() as Based.Context.GlobalOptions<'yes'>

  globalOptions = {
    ...globalOptions,
    ...(skip !== undefined && { skip }),
    ...(display !== undefined && { display }),
  }

  this.set('globalOptions', globalOptions)

  return globalOptions
}
