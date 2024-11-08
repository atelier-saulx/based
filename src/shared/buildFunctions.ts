import { type BundleResult, bundle } from '@based/bundle'

type BuildFunctionsArgs = {
  publicPath: string
  browserEntryPoints: string[]
  nodeEntryPoints: string[]
  cb: (err: Error | null, res: BundleResult) => void
}

export const buildFunctions = async ({
  publicPath,
  browserEntryPoints,
  nodeEntryPoints,
  cb,
}: BuildFunctionsArgs) =>
  await Promise.all([
    bundle(
      {
        entryPoints: nodeEntryPoints,
        sourcemap: 'external',
      },
      cb,
    ),
    bundle(
      {
        publicPath,
        entryPoints: browserEntryPoints,
        sourcemap: true,
        platform: 'browser',
        bundle: true,
        define: {
          global: 'window',
          'process.env.NODE_ENV': '"production"',
        },
      },
      cb,
    ),
  ])
