import fs from 'fs-extra'
import path from 'path'
import fetch from 'node-fetch'
import { GlobalOptions } from '../command'
import { GenericOutput } from '../types'
import { gitHubFetch } from './gitHubFetch'

const saveFile = async (repoPath, outputPath) => {
  await fetch(repoPath, {
    headers: {
      Accept: 'application/vnd.github.VERSION.raw',
      ...(process.env.GH_PAT
        ? {
            Authorization: 'token ' + process.env.GH_PAT,
          }
        : null),
    },
  }).then((res) => {
    const dest = fs.createWriteStream(outputPath)
    res.body.pipe(dest)
  })
}

const walk = async (
  repoPath: string,
  destPath: string,
  output: GenericOutput,
  options: GlobalOptions
) => {
  const fetchResult = await gitHubFetch(repoPath, output, options)
  if (Array.isArray(fetchResult)) {
    await Promise.all(
      fetchResult.map(async (result) => {
        if (result.type === 'file') {
          const source = result.download_url
          const destination = path.join(destPath, result.name)
          await saveFile(source, destination)
        } else if (result.type === 'dir') {
          const outputPath = path.join(destPath, result.name)
          await fs.ensureDir(outputPath)
          await walk(
            path.join(repoPath, result.name),
            outputPath,
            output,
            options
          )
        } else {
          throw new Error('content type not supported')
        }
      })
    )
  } else {
    const source = fetchResult.download_url
    const destination = path.join(destPath, fetchResult.name)
    await saveFile(source, destination)
  }
}

export const gitHubDownload = async (
  repoPath: string,
  destPath: string,
  output: GenericOutput,
  options: GlobalOptions
) => {
  const outputPath = path.join(destPath, path.basename(repoPath))
  await fs.ensureDir(outputPath)
  await walk(repoPath, outputPath, output, options)
}
