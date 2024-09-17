import { findUp } from 'find-up'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import { Command } from 'commander'

export const globalOptions = async (program: Command): Promise<void> => {
  // if (!process.env.ENV) {
  //   process.env.ENV = await getEnv()
  // }

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
  } else {
    console.info(
      `⚠️ No 'based.json' configuration file was found. It is recommended to create one.`,
    )
  }

  program
    .option(
      '-c, --cluster <cluster>',
      'Define the cluster to use.',
      args.cluster,
    )
    .requiredOption('-o, --org <org>', 'Specify the organization.', args.org)
    .requiredOption(
      '-p, --project <project>',
      'Specify the project name.',
      args.project,
    )
    .requiredOption(
      '-e, --env <env>',
      'Specify witch environment (can be a name or "#branch" if you want to Deploy by branch).',
      args.env,
    )
    .option(
      '-aK, --api-key <api-key>',
      'API Key generated on Based.io for Service Account.',
    )
}
