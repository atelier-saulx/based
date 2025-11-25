import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: ['dist/**', '!dist/lib/**'],
  entry: {
    sdk: './src/sdk.ts',
    db: './src/index.ts',
    schema: './src/schema/index.ts',
  },
})
