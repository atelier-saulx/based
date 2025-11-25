import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: ['dist/**', '!dist/lib/**'],
  entry: {
    sdk: './src/sdk.ts',
    db: './src/db.ts',
    schema: './src/schema/index.ts',
  },
})
