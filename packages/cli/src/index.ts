import { program } from 'commander'
import './apiKeys'
import './auth'
import './backups'
import './buildApp'
import './deploy'
import './env'
import './function'
import './log'
import './logout'
import './migrateBackup'
import './restartMachine'
import './schema'
import './secret'
import './services'
import './templates'

const pkg = require('../package.json')

program.version(pkg?.version)
program.parse(process.argv)
