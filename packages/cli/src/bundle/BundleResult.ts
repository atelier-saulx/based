import Module from 'node:module'
import { dirname, isAbsolute, join, relative } from 'node:path'
import watcher, { type SubscribeCallback } from '@parcel/watcher'
import {
  type BuildContext,
  type BuildFailure,
  type BuildOptions,
  type BuildResult,
  type OutputFile,
  context,
} from 'esbuild'
// import prettyBytes from 'pretty-bytes'

const cwd = process.cwd()
export class BundleResult {
  // private static instance: BundleResult
  #watchers: Map<string, Promise<watcher.AsyncSubscription>> = new Map()
  #hashes?: Record<string, string>
  #cb?: (err: BuildFailure | null, res: BundleResult) => void
  ctx?: BuildContext
  error?: BuildFailure
  result!: BuildResult<BuildOptions>
  changed?: BuildResult<BuildOptions>['outputFiles']
  updates: ChangeUpdates = []

  // public static getInstance(): BundleResult {
  //   if (!BundleResult.instance) {
  //     BundleResult.instance = new BundleResult()
  //   }

  //   return BundleResult.instance
  // }

  async watch(
    settings: BuildOptions,
    cb: (err: BuildFailure | null, res: BundleResult) => void,
  ) {
    this.#cb = cb
    this.ctx = await context(settings)

    try {
      await this.#update()
    } catch (e) {
      this.error = e as BuildFailure
      const sub = await watcher.subscribe(cwd, async () => {
        try {
          await this.#update()
          this.error = null
          sub.unsubscribe()
          cb(null, this)
        } catch {
          console.error(e)
        }
      })
    }
  }

  #filterChanged = ({ path, hash }: { path: string; hash: string }) => {
    return hash !== this.#hashes?.[path]
  }

  #onChange: SubscribeCallback = async (err: Error | null, events: any[]) => {
    if (err) {
      this.error = err as BuildFailure
      this.#cb(err as BuildFailure, this)
      return
    }

    this.updates = []

    for (const { path, type } of events) {
      const relPath = relative(cwd, path)
      if (type === 'delete') {
        this.updates.push([type, relPath])

        if (this.#watchers.has(path)) {
          const w = await this.#watchers.get(path)
          w.unsubscribe()
          this.#watchers.delete(path)

          // file deleted, need to watch higher up
          let dir = path
          dir = dirname(dir)

          while (dir) {
            try {
              const w = await watcher.subscribe(dir, this.#onChange)
              this.#watchers.set(dir, Promise.resolve(w))
              break
            } catch (e) {
              console.error(e)
            }
            dir = dirname(dir)
          }
        }
      } else if (relPath in this.result.metafile.inputs) {
        this.updates.push([type, relPath])
      }
    }

    if (this.updates.length) {
      try {
        await this.#update()

        if (this.changed?.length || this.error) {
          this.error = null
          this.#cb(null, this)
        }
      } catch (e) {
        this.error = e as BuildFailure
        this.#cb(e as BuildFailure, this)
      }
    }
  }

  async #update() {
    this.result = await this.ctx.rebuild()
    this.changed = this.#hashes
      ? this.result.outputFiles.filter(this.#filterChanged)
      : this.result.outputFiles

    this.#hashes = this.result.outputFiles.reduce(reduceToHashes, {})

    // watch these dirs
    const dirs = new Set<string>()
    for (const file in this.result.metafile.inputs) {
      if (!file.includes(':')) {
        dirs.add(dirname(join(cwd, file)))
      }
    }

    // remove nested dirs (are already watched by parent)
    for (const dir of dirs) {
      let pDir = dir
      pDir = pDir.substring(0, pDir.lastIndexOf('/'))
      while (pDir) {
        if (dirs.has(pDir)) {
          dirs.delete(dir)
          break
        }
        pDir = pDir.substring(0, pDir.lastIndexOf('/'))
      }
    }

    // watch unwatched dirs
    for (const dir of dirs) {
      if (!this.#watchers.has(dir)) {
        // const relPath = relative(cwd, dir)
        // let bytes = 0

        // if (relPath) {
        // get bytes for folder
        // const dirPath = `${relPath}/`
        // for (const file in this.result.metafile.inputs) {
        //   // if (file.startsWith(dirPath)) {
        //   //   bytes += this.result.metafile.inputs[file].bytes
        //   // }
        // }
        // } else {
        // get all bytes
        // for (const file in this.result.metafile.inputs) {
        //   if (!file.includes(':')) {
        //     bytes += this.result.metafile.inputs[file].bytes
        //   }
        // }
        // }

        // if (relPath) {
        //   if (this.debug) {
        //     console.info(
        //       pc.cyan('◯  watch'),
        //       dimNodeModules(relPath),
        //       pc.bold(prettyBytes(bytes)),
        //     )
        //   }
        // }

        this.#watchers.set(dir, watcher.subscribe(dir, this.#onChange))
      }
    }

    // unwatch old dirs
    for (const [dir, subPromise] of this.#watchers) {
      if (!dirs.has(dir)) {
        // if (this.debug) {
        //   console.info(pc.red('◯  unwatch'), dimNodeModules(relative(cwd, dir)))
        // }
        subPromise.then((sub) => sub.unsubscribe())
        this.#watchers.delete(dir)
      }
    }

    // log infos about changed outputs
    // for (const { path } of this.changed) {
    // const relPath = relative(cwd, path)
    // const { bytes } = this.result.metafile.outputs[relPath]
    // if (this.debug) {
    //   console.info(pc.blue('◉  build'), relPath, pc.bold(prettyBytes(bytes)))
    // }
    // }
  }

  async destroy() {
    const promises = Array.from(this.#watchers).map(([_, subPromise]) =>
      subPromise.then((sub) => sub.unsubscribe()),
    )
    promises.push(this.ctx.dispose())

    await Promise.all(promises)
  }

  js(input?: string): OutputFile | undefined {
    if (!input) {
      return this.first('.js')
    }

    try {
      const output = this.find(input)
      const absolute = join(cwd, output)

      return this.result.outputFiles.find(({ path = '' }) => path === absolute)
    } catch {
      return undefined
    }
  }

  html(input?: string): OutputFile | undefined {
    if (!input) {
      return this.first('.html')
    }

    try {
      const output = this.find(input, '.html')
      const absolute = join(cwd, output)

      return this.result.outputFiles.find(({ path }) => path === absolute)
    } catch {
      return undefined
    }
  }

  map(input?: string): OutputFile | undefined {
    if (!input) {
      return this.first('.js')
    }

    try {
      const output = this.find(input)
      const absolute = `${join(cwd, output)}.map`

      return this.result.outputFiles.find(({ path }) => path === absolute)
    } catch {
      return undefined
    }
  }

  css(input?: string): OutputFile | undefined {
    if (!input) {
      return this.first('.css')
    }

    try {
      const output = this.find(input)
      const { cssBundle } = this.result.metafile.outputs[output]

      if (cssBundle) {
        const absolute = join(cwd, cssBundle)
        return this.result.outputFiles.find(({ path }) => path === absolute)
      }
    } catch {
      return undefined
    }
  }

  first(ext: string): OutputFile | undefined {
    return this.result.outputFiles.find(({ path }) => path.endsWith(ext))
  }

  find(input: string, ext?: string): string | undefined {
    if (isAbsolute(input)) {
      input = relative(cwd, input)
    }

    try {
      for (const file in this.result.metafile.outputs) {
        const output = this.result.metafile.outputs[file]
        if (output.entryPoint === input) {
          if (!ext) {
            return file
          }
          if (file.endsWith(ext)) {
            return file
          }
        }
      }
    } catch {
      return undefined
    }
  }

  require(input?: string): any | undefined {
    try {
      const { path, hash, text } = this.js(input)!
      const module = new Module(hash)
      // @ts-ignore
      module._compile(text, path)

      return module.exports
    } catch {
      return undefined
    }
  }
}

const reduceToHashes = (obj, { path, hash }) => {
  obj[path] = hash
  return obj
}

// const m = 'node_modules/'
// const mLength = m.length
// const dimNodeModules = (path: string) => {
//   if (!path) {
//     return '.'
//   }
//   const i = path.lastIndexOf(m)
//   if (i === -1) {
//     return path
//   }
//   if (i === 0) {
//     return `${pc.dim(m)}${path.substring(mLength)}`
//   }
//   const j = i + mLength
//   return `${pc.dim(path.substring(0, j))}${path.substring(j)}`
// }

type ChangeUpdates = [type: string, relPath: string][]
