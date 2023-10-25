import { BasedFunctionConfig } from '@based/functions'

export const parseFunction = async (
  config: BasedFunctionConfig,
  contents: string
): Promise<string> => {
  console.info('go parse this', config, contents)

  return 'lullz types'
}
