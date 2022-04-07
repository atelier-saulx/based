import { program } from 'commander'
import { command as addGlobalOptions } from '../command'
import { servicesAddCommand } from './add'
import { servicesLsCommand } from './ls'
import { servicesRemoveCommand } from './remove'
import { servicesScaleCommand } from './scale'
import { servicesRestartCommand } from './restart'

program
  .command('services')
  .description('Manage services')
  .addCommand(addGlobalOptions(servicesAddCommand))
  .addCommand(addGlobalOptions(servicesLsCommand))
  .addCommand(addGlobalOptions(servicesRemoveCommand))
  .addCommand(addGlobalOptions(servicesScaleCommand))
  .addCommand(addGlobalOptions(servicesRestartCommand))
