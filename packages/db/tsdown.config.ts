import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: ['dist/**', '!dist/lib/**'],
  minify: true,
  fixedExtension: false,
  entry: {
    sdk: './src/sdk.ts',
    db: './src/index.ts',
    schema: './src/schema/index.ts',
  },
})
