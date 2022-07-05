const fs = require('fs/promises')
const path = require('path')
// const walk = require('@root/walk').walk
const esbuild = require('esbuild')

const walkFolders = async (pathname) => {
  const contents = await fs.readdir(pathname)
  let promises = []

  if (contents.includes('based.config.js')) {
    const indexFile = contents?.find(
      (content) => content === 'index.ts' || content === 'index.js'
    )
    if (!indexFile) {
      throw new Error("Can't find index file for function " + pathname)
    } else {
      const { name } = require(path.join(pathname, 'based.config.js'))
      const outFolder = path.join(
        __dirname,
        '../dist',
        pathname.split(path.join(__dirname, '../src'))[1]
      )
      try {
        await fs.mkdir(outFolder, { recursive: true })
      } catch (e) {}
      promises.push(
        esbuild
          .build({
            entryPoints: [path.join(pathname, indexFile)],
            outfile: path.join(outFolder, name + '-bundle.js'),
            bundle: true,
            minify: true,
            platform: 'node',
          })
          .catch((err) => {
            console.error(err)
            process.exit(1)
          })
      )
    }
  }

  return promises
    .concat(
      await Promise.all(
        contents.map(async (content) => {
          const p = path.join(pathname, content)
          const stats = await fs.lstat(p)
          if (stats.isDirectory() && !stats.isSymbolicLink()) {
            return await walkFolders(path.join(pathname, content))
          }
        })
      )
    )
    .filter(Boolean)
    .flat()
}

!(async () => {
  const promises = await walkFolders(path.join(__dirname, '../src'))
  await Promise.all(promises)
})()
