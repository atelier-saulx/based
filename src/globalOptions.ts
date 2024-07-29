import { findUp } from 'find-up'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'

export const globalOptions = async (program) => {
  const configPath = await findUp(['based.json', 'based.js', 'based.ts'])
  const args: {
    cluster: string
    project?: string
    org?: string
    env?: string
  } = {
    cluster: 'production',
  }

  if (configPath) {
    if (configPath.endsWith('.json')) {
      Object.assign(args, await readJSON(configPath))
    } else {
      const bundled = await bundle({
        entryPoints: [configPath],
      })
      const compiled = bundled.require()
      Object.assign(args, compiled.default || compiled)
    }
  }

  program
    .option('-c, --cluster <cluster>', 'Based cluster', args.cluster)
    .requiredOption('-o, --org <org>', 'Organization name', args.org)
    .requiredOption('-p, --project <project>', 'Project name', args.project)
    .requiredOption('-e, --env <env>', 'Environment name', args.env)
    .option('--api-key <api-key>', 'API key for service account')
}
