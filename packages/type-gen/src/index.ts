import { BasedFunctionConfig } from '@based/functions'

export const parseFunction = async (
  config: BasedFunctionConfig,
  contents: string
): Promise<string> => {
  console.info('go parse this', config, contents)

  if (!config) {
    throw new Error('Provide a config to parse an fn from!')
  }

  const fnTypes = parseCode(contents)

  console.info(fnTypes)

  return 'lullz types'
}
