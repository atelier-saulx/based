import test from 'ava'
import fs from 'fs'
import { parseFunction } from '../src'
import { join } from 'path'

test.serial('Generare types file from examples', async (t) => {
  const config = require('./examples/helloWorld/based.config.json')
  const helloWorld = fs
    .readFileSync(join(__dirname, '/examples/helloWorld/index.ts'))
    .toString('utf-8')

  const result = await parseFunction(config, helloWorld)

  console.info('RESULT', result)

  t.pass('flap')
})
