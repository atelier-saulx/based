import { Command, program } from 'commander'
import { command as addGlobalOptions } from '../command'
import { templateLsCommand } from './ls'
import { templateInstallCommand } from './install'

program
  .command('templates')
  .description('Manage templates')
  .addCommand(addGlobalOptions(templateLsCommand))
  .addCommand(addGlobalOptions(templateInstallCommand))
