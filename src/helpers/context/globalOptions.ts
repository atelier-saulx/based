export function contextGlobalOptions(): Based.Context.GlobalOptions<'skip'> {
  let globalOptions: Based.Context.GlobalOptions<'skip'> =
    this.get('globalOptions')

  const { yes: skip, display } =
    this.program.opts() as Based.Context.GlobalOptions<'yes'>

  globalOptions = {
    ...globalOptions,
    ...(skip && { skip }),
    ...(display && { display }),
  }

  this.set('globalOptions', globalOptions)

  return globalOptions
}
