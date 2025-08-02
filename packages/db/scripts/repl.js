import repl from 'node:repl';
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { BasedDb } from '../dist/src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

function initializeContext(context) {
  const db = new BasedDb({
    path: resolve(join(__dirname, '../tmp'))
  })
  db.start({})
  Object.defineProperty(context, 'db', {
    configurable: true,
    enumerable: true,
    value: db,
  })

}

console.log('Type .help for help')
const r = repl.start('based > ')
r.defineCommand('savedb', {
    help: 'Save the DB',
    action() {
      this.context.db.save().then(() => this.displayPrompt())
    },
});
r.on('reset', initializeContext)
initializeContext(r.context)
