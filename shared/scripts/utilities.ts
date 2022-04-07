import chalk from 'chalk'
import { ReleaseType, Inquiry, Prompts, Question } from 'types'

/**
 * Bump / incrememt version with patch, minor or major.
 *
 * @param version - input version, in the format of `{major}.{minor}.{patch}`
 * @param options - publish type - { major | minor | patch }
 * @returns string
 */
export function getIncrementedVersion({
  version,
  type,
}: {
  version: string
  type: string
}): string {
  const INCREMENT_TYPES: string[] = ['patch', 'minor', 'major']

  if (!INCREMENT_TYPES.includes(type)) {
    const errorMessage = `Incorrect version type: ${chalk.red(
      type
    )}, it should be one of these values: ${INCREMENT_TYPES.join(', ')}`

    console.error(errorMessage)

    process.exit(1)
  }

  const updateVersion = (raw: string): string => {
    const splitVersion = raw.split('.')

    if (type === 'patch') {
      splitVersion[2] = (parseInt(splitVersion[2], 10) + 1).toString()
    }

    if (type === 'minor') {
      splitVersion[1] = (parseInt(splitVersion[1], 10) + 1).toString()
      splitVersion[2] = '0'
    }

    if (type === 'major') {
      splitVersion[0] = (parseInt(splitVersion[0], 10) + 1).toString()
      splitVersion[1] = '0'
      splitVersion[2] = '0'
    }

    return splitVersion.join('.')
  }

  try {
    return updateVersion(version)
  } catch (error) {
    console.error('Failed to update version')
    process.exit(1)
  }
}

export const MapPrompts = (prompts: Prompts): Inquiry[] => {
  const Questions: Inquiry[] = Object.entries(prompts).map((prompt) => {
    const [name, message] = prompt as [Question, string]

    return {
      type: 'toggle',
      name,
      message,
      initial: true,
      enabled: 'Yes',
      disabled: 'No',
    }
  })

  return Questions
}

export const CamelToSentence = (camelCase: string) => {
  const toSentence = camelCase.replace(/([A-Z]+)*([A-Z][a-z])/g, '$1 $2')
  const lowerCaseAll = toSentence.toLowerCase()
  const upperCased =
    lowerCaseAll.charAt(0).toUpperCase() + lowerCaseAll.slice(1)

  return upperCased
}

export const ToReadable = (input: string | boolean) => {
  if (typeof input === 'string') {
    return input
  }

  return input ? 'Yes' : 'No'
}

type FormattedOptions = [string, string]

export const FormatOptions = (printedOptions: {
  [key: string]: string | boolean
}): FormattedOptions[] => {
  return Object.entries(printedOptions).map((option) => {
    const [optionName, value] = option

    const toSentence = CamelToSentence(optionName)
    const toReadableValue = ToReadable(value)

    return [toSentence, toReadableValue]
  })
}

export const INCREMENT_TYPES: ReleaseType[] = ['patch', 'minor', 'major']

export function validateReleaseType(input: ReleaseType): string {
  if (!INCREMENT_TYPES.includes(input)) {
    const errorMessage = `Incorrect release type: ${chalk.red(
      input
    )}, it should be one of these values: ${INCREMENT_TYPES.join(', ')}`

    console.error(errorMessage)

    throw new Error('Invalid release arguments')
  }

  return input
}
