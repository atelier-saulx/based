import { defineConfig } from 'tsdown'

export default defineConfig({
  // minify: true,
  entry: {
    sdk: './src/index.ts',
    db: './src/db.ts',
    schema: './src/schema.ts',
  },
})
