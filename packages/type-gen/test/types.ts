import test from 'ava'
import fs from 'fs'
import { parseFunction } from '../src'
import { join } from 'path'
import based, { BasedClient } from '@based/client'

test.serial('Generare types file from examples', async (t) => {
  const config = require('./examples/helloWorld/based.config.json')
  const helloWorld = fs
    .readFileSync(join(__dirname, '/examples/helloWorld/index.ts'))
    .toString('utf-8')

  const result = await parseFunction(config, helloWorld)

  console.info('RESULT', result)

  const client = based({})

  // client.call('')

  const y = await client.call('hello-world', { msg: 'x', gurt: 1 })

  t.pass('flap')
})
