export type Question = 'triggerBuild' | 'publishChangesToNPM' | 'commitChanges'

export type Prompts = {
  [key in Question]: string
}

export type Inquiry = {
  message: string
  name: Question
  type: string
}

export type Answers = {
  [key in Question]: boolean
}

export type ReleaseType = 'patch' | 'minor' | 'major'
