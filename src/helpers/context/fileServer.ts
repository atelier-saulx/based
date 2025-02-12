import { createServer } from 'node:http'
import { basename, extname } from 'node:path'
import type { OutputFile } from '@based/bundle'

const getContentType = (extension: string) => {
  switch (extension) {
    case '.html': {
      return 'text/html'
    }

    case '.js': {
      return 'application/javascript'
    }

    case '.css': {
      return 'text/css'
    }

    case '.json': {
      return 'application/json'
    }

    case '.png': {
      return 'image/png'
    }

    case '.jpg':
    case '.jpeg': {
      return 'image/jpeg'
    }

    case '.gif': {
      return 'image/gif'
    }

    default: {
      return 'application/octet-stream'
    }
  }
}

export async function contextFileServer(
  port: number,
  files: () => OutputFile[],
): Promise<any> {
  const getFileContent = (requestedFileName: string) =>
    files().find((file) => basename(file.path) === requestedFileName)

  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' })

        return res.end('Method Not Allowed')
      }

      const urlPath = req.url ? req.url.split('?')[0] : '/'
      const requestedFileName =
        urlPath === '/'
          ? 'index.html'
          : urlPath.startsWith('/')
            ? urlPath.slice(1)
            : urlPath

      const fileContent = getFileContent(requestedFileName)

      if (!fileContent) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })

        return res.end('File Not Allowed or Not Found')
      }

      try {
        const data = Buffer.from(fileContent.contents)
        const ext = extname(fileContent.path).toLowerCase()
        const contentType = getContentType(ext)

        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        })

        res.end(data)
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')

        throw new Error(error)
      }
    })

    server.listen(port, () => resolve(server))
  })
}
