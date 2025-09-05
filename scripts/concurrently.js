import { concurrently } from 'concurrently'
import { execSync } from 'node:child_process'
const script = process.argv[2]
const workspaces = Object.keys(
  JSON.parse(execSync('npm ls -ws --json')).dependencies,
)

concurrently(
  workspaces.map((workspace) => ({
    command: `npm run ${script} -w ${workspace} --if-present`,
    name: `${workspace}`,
  })),
)
