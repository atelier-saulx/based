import { Command } from 'commander'
import { version } from './version.js'
import { deploy } from './deploy.js'
import { globalOptions } from './globalOptions.js'

export const init = async () => {
  const program = new Command()
  Promise.all([globalOptions(program), version(program), deploy(program)]).then(
    () => program.parse(process.argv),
  )
}
