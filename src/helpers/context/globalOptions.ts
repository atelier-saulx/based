export function contextGlobalOptions(): BasedCli.Context.GlobalOptions<'skip'> {
  let globalOptions: BasedCli.Context.GlobalOptions<'skip'> =
    this.get('globalOptions')

  const { yes: skip, display } =
    this.program.opts() as BasedCli.Context.GlobalOptions<'yes'>

  globalOptions = {
    ...globalOptions,
    ...(skip && { skip }),
    ...(display && { display }),
  }

  this.set('globalOptions', globalOptions)

  return globalOptions
}
