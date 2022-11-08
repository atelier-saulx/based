import fetch from 'node-fetch'
import { GlobalOptions } from '../command'
import { GenericOutput } from '../types'
import { fail } from '../tui'

export type GitHubItem = {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: 'dir' | 'file'
}
export const gitHubFetch = (
  url: string,
  output: GenericOutput,
  options: GlobalOptions
): Promise<GitHubItem | GitHubItem[]> =>
  fetch('https://api.github.com/repos/atelier-saulx/based/contents' + url, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(process.env.GH_PAT
        ? {
            Authorization: 'token ' + process.env.GH_PAT,
          }
        : null),
    },
  }).then((r) => {
    if (r.status === 403) {
      fail(
        'GitHub is rate limiting the calls from your IP. Please consider using a Personal Access Token by setup and environment variable called GH_PAT with your token. See this link for more info: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
        output,
        options
      )
    } else if (r.status === 401) {
      fail('Bad GitHub credentials', output, options)
    } else if (r.status !== 200) {
      // options.debug && printError(error)
      fail('Error accessing GitHub: ' + r.statusText, output, options)
    }
    return r.json() as Promise<GitHubItem | GitHubItem[]>
  })
