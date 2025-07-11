import type { Command } from 'commander'
import { PERSISTENT_STORAGE, program } from '../../index.js'
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { printHeader } from '../../tui.js'

export const logoutCmd = async (program: Command) => {
  program
    .command('logout')
    .description('logout user')
    .action(async (_options, cmd) => {
      printHeader()
      const { cluster } = program.optsWithGlobals()

      try {
        unlinkSync(join(PERSISTENT_STORAGE, cluster))
        console.info('User logged out')
      } catch {}
    })
}
