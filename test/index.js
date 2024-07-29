// @ts-check
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'ava'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const __dirname = fileURLToPath(dirname(import.meta.url))

const execAsync = promisify(exec)

test.skip('cli', async (t) => {
  const res = await execAsync(`node ${join(__dirname, '../bin/cmd.js')}`)
})
