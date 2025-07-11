import type { Command } from 'commander'
import { dev } from './index.js'

export const devCmd = (program: Command) => {
  program
    .command('dev')
    .description('Start development server.')
    .action(async (_options, cmd) => {
      // console.log(cmd.optsWithGlobals())
      await dev()
    })
}
