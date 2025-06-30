import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepCopy, wait } from '@saulx/utils'
import populate from './shared/populate/index.js'

const schema = {
  locales: {
    sq: { required: true },
    hy: { required: true },
    az: { required: true },
    hr: { required: true },
    cs: { required: true },
    da: { required: true },
    et: { required: true },
    fi: { required: true },
    fr: { required: true },
    ka: { required: true },
    de: { required: true },
    el: { required: true },
    is: { required: true },
    ga: { required: true },
    he: { required: true },
    it: { required: true },
    lv: { required: true },
    lt: { required: true },
    lb: { required: true },
    mt: { required: true },
    cnr: { required: true },
    nl: { required: true },
    no: { required: true },
    pl: { required: true },
    pt: { required: true },
    sr: { required: true },
    sl: { required: true },
    es: { required: true },
    sv: { required: true },
    uk: { required: true },
    en: { required: true },
  },
  props: {
    version: 'json',
    info: { type: 'text', format: 'html' },
    terms: {
      type: 'object',
      props: {
        title: 'text',
        introductionTitle: 'text',
        introductionText: { type: 'text', format: 'html' },
        rulesTitle: 'text',
        rulesText: { type: 'text', format: 'html' },
        procedureTitle: 'text',
        procedureText: { type: 'text', format: 'html' },
        noRefundsTitle: 'text',
        noRefundsText: { type: 'text', format: 'html' },
        dataTitle: 'text',
        dataText: { type: 'text', format: 'html' },
        voterRespTitle: 'text',
        voterRespText: { type: 'text', format: 'html' },
        votingWindowsTitle: 'text',
        votingRegionTitle: 'text',
        votingRegionDisclaimer: 'text',
        generalCondTitle: 'text',
        generalCondText: { type: 'text', format: 'html' },
        jurisdictionTitle: 'text',
        jurisdictionText: { type: 'text', format: 'html' },
        changesTitle: 'text',
        changesText: { type: 'text', format: 'html' },
        lastUpdatedText: { type: 'text', format: 'html' },
        lastUpdated: 'timestamp',
        firstSemiFinal: 'text',
        secondSemiFinal: 'text',
        grandFinal: 'text',
        preShow: 'text',
        liveShow: 'text',
        showStart: 'text',
        votingStart: 'text',
        votingEnd: 'text',
        afterLast: 'text',
        shortlyAfter: 'text',
        approx15After: 'text',
        approx30After: 'text',
        maxVotes: 'text',
        priceVote: 'text',
      },
    },
    privacy: { type: 'string', format: 'html' },
    excludedCountries: { items: { ref: 'country' } },
    activeSequence: { ref: 'sequence' },
    live: { ref: 'phase' },
    preview: { ref: 'phase' },
    coreDataLock: 'boolean',
    winner: 'string',
    onboarding: {
      type: 'object',
      props: {
        online: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        phone: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        nonParticipating: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        notAllowedSemi1: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        notAllowedSemi2: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        nonVoting: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        overseasParent: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        overseasPhone: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
        overseasOnline: {
          type: 'object',
          props: {
            title: 'text',
            description: { type: 'text', format: 'multiline' },
          },
        },
      },
    },
    translated: 'text',
    dictionary: {
      type: 'object',
      props: {
        onboardingTitleGeneric: { type: 'text', format: 'multiline' },
        onboardingTitleOverseas: { type: 'text', format: 'multiline' },
        onboardingTitleNonParticipating: { type: 'text', format: 'multiline' },
        whyImportant: 'text',
        cookieDisclaimer: { type: 'text', format: 'multiline' },
        continueButton: 'text',
        changeRegion: 'text',
        changeRegionDescription: { type: 'text', format: 'multiline' },
        changeLanguage: 'text',
        votingInfo: 'text',
        terms: 'text',
        privacy: 'text',
        imprint: 'text',
        days: 'text',
        hours: 'text',
        minutes: 'text',
        seconds: 'text',
        recapTitle: 'text',
        recapDescription: { type: 'text', format: 'multiline' },
        startVotingNow: 'text',
        votingClosed: 'text',
        addVotes: 'text',
        onlineDescription: { type: 'text', format: 'multiline' },
        viewSelection: 'text',
        voteCall: 'text',
        voteSMS: 'text',
        phoneDescription: { type: 'text', format: 'multiline' },
        selectionTitle: 'text',
        selectionDescription: 'text',
        selectionButton: 'text',
        selectionSecure: 'text',
        phoneSelection: 'text',
        phoneRegion: 'text',
        phoneCallNow: 'text',
        phoneSendSMS: 'text',
        vote: 'text',
        votes: 'text',
        summaryTotal: 'text',
        summaryTitle: 'text',
        summarySelect: 'text',
        summarySecure: 'text',
        summaryReceiptInfo: 'text',
        summaryEmail: 'text',
        summaryPaymentConditions: 'text',
        summaryDisclaimer: { type: 'text', format: 'multiline' },
        summaryRefund: 'text',
        summaryCheckbox: 'text',
        summaryButton: 'text',
        summaryProcessing: 'text',
        summaryProcessingMsg: { type: 'text', format: 'multiline' },
        summaryLongWait: 'text',
        thankYou: 'text',
        thankYouOnline: { type: 'text', format: 'multiline' },
        thankYouOnlineButton: 'text',
        thankYouPhone: { type: 'text', format: 'multiline' },
        thankYouPhoneButton: 'text',
        thankYouMax: { type: 'text', format: 'multiline' },
        thankYouMaxButton: 'text',
        errorCaptcha: 'text',
        errorWrongRegion: 'text',
        errorCardAlreadyUsed: 'text',
        errorGeneric: 'text',
        appleMusic: { type: 'text', format: 'multiline' },
        appleMusicDisclaimer: { type: 'text', format: 'multiline' },
        privacyInstruction: 'text',
        selectedRegion: 'text',
        participatingBroadcaster: 'text',
        closeButton: 'text',
      },
    },
    announcement: 'string',
    disqualifiedCountries: 'json',
  },
  types: {
    country: {
      name: 'alias',
      displayName: 'string',
      currency: [
        'all',
        'amd',
        'aud',
        'azn',
        'chf',
        'czk',
        'dkk',
        'eur',
        'gbp',
        'gel',
        'ils',
        'isk',
        'mdl',
        'nok',
        'pln',
        'rsd',
        'sek',
        'uah',
      ],
      voteType: ['sms_text', 'sms_suffix', 'online', 'call_suffix'],
      dialCode: 'uint16',
      maxVotes: 'uint8',
      isTerritoryOf: { ref: 'country', prop: 'overseasTerritories' },
      price: 'uint16',
      destination: 'string',
      votingText: 'string',
      votingLegal: 'string',
      broadcaster: 'string',
      privacyUrl: 'string',
      scenario: { ref: 'scenario', prop: 'countries' },
    },
    sequence: {
      name: { type: 'alias', readOnly: true },
      displayName: 'string',
      goLiveTime: 'timestamp',
      recapVideo: { ref: 'file', prop: 'sequenceRecapVideo' },
      title: 'text',
      description: { type: 'text' },
      countdown: 'timestamp',
      isVoting: 'boolean',
      translated: 'text',
      extraBool: 'boolean',
      hello: 'boolean',
    },
    round: {
      name: { type: 'alias', readOnly: true },
      displayName: 'string',
      contestants: { items: { ref: 'contestant', prop: 'rounds' } },
      preShowtime: 'timestamp',
      showtime: 'timestamp',
      createdBy: { ref: 'user', prop: 'createdRounds' },
    },
    contestant: {
      name: 'string',
      song: 'string',
      appleMusicSong: 'string',
      lyrics: { type: 'string', format: 'multiline' },
      country: { ref: 'country', prop: 'contestants' },
      image: { ref: 'file', prop: 'contestant_image' },
      storyThankYouVideo: {
        ref: 'file',
        prop: 'contestant_story_thank_you_video',
      },
      thankYouVideos: { items: { ref: 'file', prop: 'contestant_ty_video' } },
      ddi: { props: { semi1: 'alias', semi2: 'alias', final: 'alias' } },
    },
    user: {
      name: 'string',
      email: { type: 'alias', format: 'email' },
      role: ['admin', 'translator', 'viewer'],
      translatorOf: { items: { ref: 'language', prop: 'translators' } },
      avatar: { ref: 'file', prop: 'avatarOf' },
      currentToken: 'alias',
      status: ['login', 'clear', 'invited'],
      createdAt: { type: 'timestamp', on: 'create' },
      updatedAt: { type: 'timestamp', on: 'update' },
      invited: { items: { ref: 'user', prop: 'invitedBy' } },
      invitedBy: { ref: 'user', prop: 'invited' },
      location: 'string',
      lang: 'string',
      inactive: 'boolean',
    },
    file: {
      name: 'string',
      src: { type: 'string', format: 'URL' },
      mimeType: 'string',
      description: 'string',
      progress: { type: 'number', display: 'ratio' },
      status: ['uploading', 'transcoding', 'ready', 'error'],
      statusText: 'string',
      size: 'int32',
      createdAt: { type: 'timestamp', on: 'create' },
      updatedAt: { type: 'timestamp', on: 'update' },
      thumbnail: { type: 'string', format: 'URL' },
      hls: { type: 'string', format: 'URL' },
      dash: { type: 'string', format: 'URL' },
      videoPreview: { type: 'string', format: 'URL' },
      selvaId: { type: 'alias', readOnly: true },
    },
    language: {
      iso: { type: 'alias', required: true },
      name: 'string',
      translators: { items: { ref: 'user', prop: 'translatorOf' } },
      countries: { items: { ref: 'country', prop: 'languages' } },
    },
    scenario: { name: 'alias' },
    phase: {
      name: 'alias',
      round: { ref: 'round', prop: 'phases' },
      scenarios: {
        items: {
          ref: 'scenario',
          prop: 'phases',
          $sequence: { ref: 'sequence' },
        },
      },
    },
  },
} as const

await test.skip('escMigrate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true, queryThreads: 1 })

  t.after(() => t.backup(db))

  // @ts-ignore
  await db.setSchema(schema)
  await populate(db)

  // db.client.on('info', console.info)
  const ints = [
    setInterval(() => {
      db.query('sequence').get()
    }, 5),
    setInterval(() => {
      db.query('contestant').get()
    }, 6),
    setInterval(() => {
      db.query('country').get()
    }, 7),
    setInterval(() => {
      db.update('contestant', 1, {
        name: 'name:' + Math.random(),
      })
    }, 100),
  ]

  let prevSchema = schema
  let c = 1
  while (c--) {
    for (const type of ['string', 'boolean', 'number']) {
      const newSchema = deepCopy(schema) as typeof schema
      // @ts-ignore
      newSchema.types.contestant = {
        extraField: type,
        [`${type}Field`]: type,
        [`${type + c}Field`]: type,
        ...prevSchema.types.contestant,
      }
      prevSchema = newSchema
      // @ts-ignore
      await db.setSchema(newSchema)
      await wait(200)
    }
  }

  for (const i of ints) {
    clearTimeout(i)
  }
})
