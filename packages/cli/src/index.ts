import { program } from 'commander'
import './function'
import './schema'
import './secret'
import './event'
import './auth'
import './logout'
import './env'
import './backups'
import './restartMachine'
import './migrateBackup'
import './deploy'
import './apiKeys'
import './services'
import './log'
import './templates'

const pkg = require('../package.json')

program.version(pkg?.version)
program.parse(process.argv)
