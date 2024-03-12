import test from 'ava'
import { startOrigin, SelvaServer } from '@based/db-server'
import './assertions/index.js'
import getPort from 'get-port'

test('simple test', async (t) => {
  t.true(true)
})
