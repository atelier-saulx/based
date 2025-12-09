import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { hash } from '@saulx/hash'
import type { OutputFile, Plugin, PluginBuild } from 'esbuild'
import { Parser } from 'htmlparser2'

export const htmlPlugin: Plugin = {
  name: 'html-plugin',
  setup(build: PluginBuild) {
    const cwd = process.cwd()
    let htmls = {}

    const parseHtml = async (path: string) => {
      const scripts: {
        start: number
        end: number
        src: string
        text?: string
      }[] = []
      let inScript = false
      const parser = new Parser({
        onopentag(name, attr) {
          inScript = name === 'script'

          if (!inScript) {
            if (
              name === 'link' &&
              attr.href.endsWith('.js') &&
              /$(\.|\/)/.test(attr.href)
            ) {
              inScript = true
            }
          }

          if (inScript) {
            scripts.push({
              start: parser.startIndex,
              end: null,
              src: attr.src,
            })
            return
          }
        },
        ontext(text) {
          if (inScript) {
            scripts[scripts.length - 1].text = text
          }
        },
        onclosetag() {
          if (inScript) {
            inScript = false
            scripts[scripts.length - 1].end = parser.endIndex
          }
        },
      })

      let contents: string = (await readFile(path)).toString()

      if (build.initialOptions.minify) {
        contents = contents
          // reduce whitespace to a single space
          .replace(/\s+/gm, ' ')
          // remove space between tags
          .replace(/> </g, '><')
          // remove space between edge and start/end tags
          .replace(/^ </g, '<')
          .replace(/> $/g, '>')

        if (build.initialOptions.ignoreAnnotations) {
          contents = contents.replace(/<!--.*?-->/gs, '')
        }
      }

      parser.write(contents)
      parser.end()

      htmls ??= {}
      htmls[path] = { scripts, contents }

      const shim = scripts.map(({ src, text }) => {
        if (src) {
          return `import '${src}';`
        }
        if (text) {
          return `${text};`
        }
        return ''
      })

      return {
        contents,
        scripts,
        shim: shim.join(''),
      }
    }

    build.onLoad({ filter: /.html$/, namespace: 'html-plugin' }, (args) => {
      return {
        contents: args.pluginData.contents,
        loader: 'file',
      }
    })

    build.onLoad({ filter: /.html$/, namespace: 'file' }, async ({ path }) => {
      const { contents, shim } = await parseHtml(path)

      return {
        pluginData: { contents, path: path },
        contents: shim,
        loader: 'js',
      }
    })

    build.onEnd(async (res) => {
      if (htmls) {
        for (const path in htmls) {
          const { scripts, contents } = htmls[path]
          const relPath = relative(cwd, path)

          for (const jsPath in res.metafile.outputs) {
            const { entryPoint } = res.metafile.outputs[jsPath]
            if (relPath === entryPoint) {
              const chars = contents.split('')
              let i: number = 0
              for (const { start, end } of scripts) {
                for (i = start; i <= end; i++) {
                  chars[i] = ''
                }
              }
              chars[i] =
                `<script src="${build.initialOptions.publicPath || ''}/${jsPath}"></script>`
              const text = chars.join('')
              const hashed = hash(text).toString(36)
              const name = path.substring(
                path.lastIndexOf('/') + 1,
                path.lastIndexOf('.'),
              )
              const outputFile: OutputFile = {
                path: `${join(cwd, name)}-${hashed}.html`,
                text,
                hash: hashed,
                contents: Buffer.from(text),
              }
              res.outputFiles = [...res.outputFiles, outputFile]
              res.metafile.outputs[relative(cwd, outputFile.path)] = {
                entryPoint: relPath,
                inputs: {},
                imports: [],
                exports: [],
                bytes: outputFile.contents.byteLength,
              }
              break
            }
          }
        }

        htmls = null
      }
    })
  },
}
