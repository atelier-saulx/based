import { lyrics } from './lyrics.js'

export const contestants = [
  {
    name: 'Shkodra Elektronike',
    lyrics: lyrics.AL,
    song: 'Zjerm',
    appleMusicSong: 'zjerm/1807796622?i=1807796625',
    country: { upsert: { name: 'AL' } }, // Albania
    ddi: { semi1: '12' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/SHK-10.jpg?itok=fBRRWoS0',
        selvaId: 'AL',
      },
    },
  },
  {
    name: 'PARG',
    lyrics: lyrics.AM, // Lyrics TBD
    song: 'SURVIVOR',
    appleMusicSong: 'survivor/1803172065?i=1803172067',
    country: { upsert: { name: 'AM' } }, // Armenia
    ddi: { semi2: '05' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Parg2812.jpg?h=ddecd561&itok=o-p3gGQG',
        selvaId: 'AM',
      },
    },
  },
  {
    name: 'Go-Jo',
    lyrics: lyrics.AU, // Lyrics TBD
    song: 'Milkshake Man',
    appleMusicSong: 'milkshake-man/1798151412?i=1798151414',
    country: { upsert: { name: 'AU' } }, // Australia
    ddi: { semi2: '01' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-02/GoJo_JeremyKeesOrr_09.jpg?h=5195bb07&itok=fBBJlJmz',
        selvaId: 'AU',
      },
    },
  },
  {
    name: 'JJ',
    lyrics: lyrics.AT, // Lyrics TBD
    song: 'Wasted Love',
    appleMusicSong: 'wasted-love/1797320538?i=1797320660',
    country: { upsert: { name: 'AT' } }, // Austria
    ddi: { semi2: '06' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-01/ESC25_AUT_JJ_full-28.jpg?h=6143e829&itok=HZqQrqy6',
        selvaId: 'AT',
      },
    },
  },
  {
    name: 'Mamagama',
    lyrics: lyrics.AZ, // Lyrics TBD
    song: 'Run With U',
    appleMusicSong: 'run-with-u/1797288228?i=1797288711',
    country: { upsert: { name: 'AZ' } }, // Azerbaijan
    ddi: { semi1: '10' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/MAMAGAMA-1.jpg?h=4445faf9&itok=_kE56nJN',
        selvaId: 'AZ',
      },
    },
  },
  {
    name: 'Red Sebastian',
    lyrics: lyrics.BE, // Lyrics TBD
    song: 'Strobe Lights',
    appleMusicSong: 'strobe-lights/1791066274?i=1791066277',
    country: { upsert: { name: 'BE' } }, // Belgium
    ddi: { semi1: '09' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/RED-SEBASTIAN-1-adjust.jpg?h=7e7caea9&itok=VY-ghPQz',
        selvaId: 'BE',
      },
    },
  },
  {
    name: 'Marko Bošnjak',
    lyrics: lyrics.HR, // Lyrics TBD
    song: 'Poison Cake',
    appleMusicSong: 'poison-cake/1787573233?i=1787573234',
    country: { upsert: { name: 'HR' } }, // Croatia
    ddi: { semi1: '14' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Croatia_Poison_Cake_Marko_Bosnjak_1.jpg?h=d6d43ece&itok=fV10tdww',
        selvaId: 'HR',
      },
    },
  },
  {
    name: 'Theo Evan',
    lyrics: lyrics.CY, // Lyrics TBD
    song: 'Shh',
    appleMusicSong: 'shh/1801226596?i=1801226660',
    country: { upsert: { name: 'CY' } }, // Cyprus
    ddi: { semi1: '15' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/SHH-COVER-PHOTO-2.jpg?h=f8a52a4c&itok=lNHBKlXC',
        selvaId: 'CY',
      },
    },
  },
  {
    name: 'ADONXS',
    lyrics: lyrics.CZ, // Lyrics TBD
    song: 'Kiss Kiss Goodbye',
    appleMusicSong: 'kiss-kiss-goodbye/1794358674?i=1794358680',
    country: { upsert: { name: 'CZ' } }, // Czechia
    ddi: { semi2: '12' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/DAVID_URBAN_ADONXS_COVER_ART_03-kopie.jpg?h=12c6f0a9&itok=SeMLNvJK',
        selvaId: 'CZ',
      },
    },
  },
  {
    name: 'Sissal',
    lyrics: lyrics.DK, // Lyrics TBD
    song: 'Hallucination',
    appleMusicSong: 'hallucination/1791787460?i=1791787465',
    country: { upsert: { name: 'DK' } }, // Denmark
    ddi: { semi2: '11' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/edit4.png?itok=cgceZ6uN',
        selvaId: 'DK',
      },
    },
  },
  {
    name: 'Tommy Cash',
    lyrics: lyrics.EE, // Lyrics TBD
    song: 'Espresso Macchiato',
    appleMusicSong: 'espresso-macchiato/1783135860?i=1783135861',
    country: { upsert: { name: 'EE' } }, // Estonia
    ddi: { semi1: '04' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/10.jpg?h=6bde16c2&itok=BMYuG-xk',
        selvaId: 'EE',
      },
    },
    // storyThankYouVideo: {
    //   upsert: {
    //     src: 'https://customer-rb4scmumy816frfn.cloudflarestream.com/ac935f5200f6f287e93e4ca18eb569b6/manifest/video.m3u8',
    //     selvaId: 'flap',
    //   },
    // },
    // thankYouVideos: {
    //   upsert: [
    //     {
    //       src: 'https://customer-rb4scmumy816frfn.cloudflarestream.com/02a889a935de99a8c6318b5f16de59f9/manifest/video.m3u8',
    //       selvaId: 'flip',
    //     },
    //   ],
    // },
  },
  {
    name: 'Erika Vikman',
    lyrics: lyrics.FI, // Lyrics TBD
    song: 'ICH KOMME',
    appleMusicSong: 'ich-komme/1788476066?i=1788476080',
    country: { upsert: { name: 'FI' } }, // Finland
    ddi: { semi2: '16' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/LOVETAR_1-NelliKentta.jpg?h=2783956c&itok=YX4qf4fs',
        selvaId: 'FI',
      },
    },
  },
  {
    name: 'Louane',
    lyrics: lyrics.FR, // Lyrics TBD
    song: 'maman',
    appleMusicSong: 'maman/1800452388?i=1800452757',
    country: { upsert: { name: 'FR' } }, // France (Big 5)
    ddi: { final: '01' }, // Pre-qualified
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-04/8da8b004-fca4-4d82-bb02-0498282d08da-2.jpg?itok=FpXdXHfG',
        selvaId: 'FR',
      },
    },
  },
  {
    name: 'Mariam Shengelia',
    lyrics: lyrics.GE, // Lyrics TBD
    song: 'Freedom',
    appleMusicSong: 'freedom-eurovision-2025-georgia/1801819115?i=1801819122',
    country: { upsert: { name: 'GE' } }, // Georgia
    ddi: { semi2: '10' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/IMG_4371.jpg?h=a45cbb2e&itok=Pjr3mgQr',
        selvaId: 'GE',
      },
    },
  },
  {
    name: 'Abor & Tynna',
    lyrics: lyrics.DE, // Lyrics TBD
    song: 'Baller',
    appleMusicSong: 'baller/1774269312?i=1774269554',
    country: { upsert: { name: 'DE' } }, // Germany (Big 5)
    ddi: { final: '02' }, // Pre-qualified
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/23_10_11-C-LINHNGUYEN_Abor-Tynna_019.jpg?h=fe3f4cff&itok=QBDc1vb1',
        selvaId: 'DE',
      },
    },
  },
  {
    name: 'Klavdia',
    lyrics: lyrics.GR, // Lyrics TBD
    song: 'Asteromáta',
    appleMusicSong: 'asteromata/1791841422?i=1791841428',
    country: { upsert: { name: 'GR' } }, // Greece
    ddi: { semi2: '07' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/GR-KLAVDIA_04.jpg?h=20510505&itok=LoTYf19s',
        selvaId: 'GR',
      },
    },
  },
  {
    name: 'VÆB',
    lyrics: lyrics.IS, // Lyrics TBD
    song: 'RÓA',
    appleMusicSong: 'róa/1790268678?i=1790268879',
    country: { upsert: { name: 'IS' } }, // Iceland
    ddi: { semi1: '01' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/IMG_6644.jpg?h=f0fd4ca4&itok=8i8Zy_Mv',
        selvaId: 'IS',
      },
    },
  },
  {
    name: 'EMMY',
    lyrics: lyrics.IE, // Lyrics TBD
    song: 'Laika Party',
    appleMusicSong: 'laika-party/1789520076?i=1789520078',
    country: { upsert: { name: 'IE' } }, // Ireland
    ddi: { semi2: '03' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/v1-olemartinsandness-Emmy_134.jpg?h=8c728c9e&itok=FF5vJyRL',
        selvaId: 'IE',
      },
    },
  },
  {
    name: 'Yuval Raphael',
    lyrics: lyrics.IL, // Lyrics TBD
    song: 'New Day Will Rise',
    appleMusicSong: 'new-day-will-rise/1799929825?i=1799929832',
    country: { upsert: { name: 'IL' } }, // Israel
    ddi: { semi2: '14' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Yuval-Raphael-PR-1-BEST.jpg?h=7eef1963&itok=WavyLgcF',
        selvaId: 'IL',
      },
    },
  },
  {
    name: 'Lucio Corsi',
    lyrics: lyrics.IT, // Lyrics TBD
    song: 'Volevo Essere Un Duro',
    appleMusicSong: 'volevo-essere-un-duro/1794146711?i=1794146712',
    country: { upsert: { name: 'IT' } }, // Italy (Big 5)
    ddi: { final: '03' }, // Pre-qualified
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/DSCF8932-Landscape-Credit-Simone-Biavati.jpg?itok=8oJ7GkdW',
        selvaId: 'IT',
      },
    },
  },
  {
    name: 'Tautumeitas',
    lyrics: lyrics.LV, // Lyrics TBD
    song: 'Bur Man Laimi',
    appleMusicSong: 'bur-man-laimi/1781609727?i=1781609729',
    country: { upsert: { name: 'LV' } }, // Latvia
    ddi: { semi2: '04' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Tautumeitas_8.jpg?h=5097032e&itok=M1XlCdFy',
        selvaId: 'LV',
      },
    },
  },
  {
    name: 'Katarsis',
    lyrics: lyrics.LT, // Lyrics TBD
    song: 'Tavo Akys',
    appleMusicSong: 'tavo-akys/1793316955?i=1793316968',
    country: { upsert: { name: 'LT' } }, // Lithuania
    ddi: { semi2: '08' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/1-katarsis.jpg?itok=HOhZYVEg',
        selvaId: 'LT',
      },
    },
  },
  {
    name: 'Laura Thorn',
    lyrics: lyrics.LU, // Lyrics TBD
    song: 'La Poupée Monte Le Son',
    appleMusicSong: 'la-poupée-monte-le-son/1785952116?i=1785952117',
    country: { upsert: { name: 'LU' } }, // Luxembourg
    ddi: { semi2: '13' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Laura-20.02.2025-884.jpg?h=8810d7df&itok=hyCeYUj5',
        selvaId: 'LU',
      },
    },
  },
  {
    name: 'Miriana Conte',
    lyrics: lyrics.MT, // Lyrics TBD
    song: 'SERVING',
    appleMusicSong:
      'serving-eurovision-official-version/1808659296?i=1808659297',
    country: { upsert: { name: 'MT' } }, // Malta
    ddi: { semi2: '09' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Miriana-Official-Shoot-07.jpg?h=61fa50b8&itok=wILVLYhg',
        selvaId: 'MT',
      },
    },
  },
  {
    name: 'Nina Žižić',
    lyrics: lyrics.ME, // Lyrics TBD
    song: 'Dobrodošli',
    appleMusicSong: 'dobrodošli-eurovision-2025/1801027745?i=1801027748',
    country: { upsert: { name: 'ME' } }, // Montenegro
    ddi: { semi2: '02' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Nina-Zizic-1.jpeg?h=25cad640&itok=Qt_VRtnc',
        selvaId: 'ME',
      },
    },
  },
  {
    name: 'Claude',
    lyrics: lyrics.NL, // Lyrics TBD
    song: `C'est La Vie`, // HTML entity kept as requested
    appleMusicSong: 'cest-la-vie/1796663926?i=1796663928',
    country: { upsert: { name: 'NL' } }, // Netherlands
    ddi: { semi1: '13' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-02/TB_Claude_Press_31499.jpg?h=2b572afe&itok=HgO28z9V',
        selvaId: 'NL',
      },
    },
  },
  {
    name: 'Kyle Alessandro',
    lyrics: lyrics.NO, // Lyrics TBD
    song: 'Lighter',
    appleMusicSong: 'lighter/1785166104?i=1785166105',
    country: { upsert: { name: 'NO' } }, // Norway
    ddi: { semi1: '08' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/3-Kyle-Alessandro-2025-03-05-pressebilder-048-TorHakon.JPG?h=1ca26648&itok=LqfnNk1H',
        selvaId: 'NO',
      },
    },
  },
  {
    name: 'Justyna Steczkowska',
    lyrics: lyrics.PL, // Lyrics TBD
    song: 'GAJA',
    appleMusicSong: 'gaja-eurovision-edit/1791560855?i=1791560857',
    country: { upsert: { name: 'PL' } }, // Poland
    ddi: { semi1: '02' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Justyna-Steczkowska-main.jpg?itok=7fJnwvds',
        selvaId: 'PL',
      },
    },
  },
  {
    name: 'NAPA',
    lyrics: lyrics.PT, // Lyrics TBD
    song: 'Deslocado',
    appleMusicSong: 'deslocado/1800621020?i=1800621031',
    country: { upsert: { name: 'PT' } }, // Portugal
    ddi: { semi1: '07' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/07_NAPA.jpg?h=03ccecd2&itok=ske_WMPz',
        selvaId: 'PT',
      },
    },
  },
  {
    name: 'Gabry Ponte',
    lyrics: lyrics.SM, // Lyrics TBD
    song: `Tutta L'Italia`, // HTML entity kept as requested
    appleMusicSong: 'tutta-litalia/1792336025?i=1792336026',
    country: { upsert: { name: 'SM' } }, // San Marino
    ddi: { semi1: '11' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/240724_GabryPonte0749.jpg?h=769e5664&itok=ArxQJCKL',
        selvaId: 'SM',
      },
    },
  },
  {
    name: 'Princ',
    lyrics: lyrics.RS, // Lyrics TBD
    song: 'Mila',
    appleMusicSong: 'mila/1792909281?i=1792909282',
    country: { upsert: { name: 'RS' } }, // Serbia
    ddi: { semi2: '15' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-04/Princ-photo-2-by-Nikola-Glisic.jpeg?h=37e0424a&itok=N6G1Hi2C',
        selvaId: 'RS',
      },
    },
  },
  {
    name: 'Klemen',
    lyrics: lyrics.SI, // Lyrics TBD
    song: 'How Much Time Do We Have Left',
    appleMusicSong: 'how-much-time-do-we-have-left/1793535327?i=1793535343',
    country: { upsert: { name: 'SI' } }, // Slovenia
    ddi: { semi1: '03' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-04/Klemen_How-Much-Time-Do-We-Have-Left_3_Tomo-Brejc.jpg?h=86e69b69&itok=Vg6u5wrX',
        selvaId: 'SI',
      },
    },
  },
  {
    name: 'Melody',
    lyrics: lyrics.ES, // Lyrics TBD
    song: 'ESA DIVA',
    appleMusicSong: 'esa-diva/1801351019?i=1801351024',
    country: { upsert: { name: 'ES' } }, // Spain (Big 5)
    ddi: { final: '04' }, // Pre-qualified
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/Melody-Eurovison44033_v1-copia.jpg?h=080709a8&itok=OBj8vbme',
        selvaId: 'ES',
      },
    },
  },
  {
    name: 'KAJ',
    lyrics: lyrics.SE, // Lyrics TBD
    song: 'Bara Bada Bastu',
    appleMusicSong: 'bara-bada-bastu/1795494351?i=1795494352',
    country: { upsert: { name: 'SE' } }, // Sweden
    ddi: { semi1: '06' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/BARABADABASTU-07C-Fotograf-Erik-Ahman.jpg?h=abddad90&itok=Veoq_7FB',
        selvaId: 'SE',
      },
    },
  },
  {
    name: 'Zoë Më',
    lyrics: lyrics.CH, // Lyrics TBD
    song: 'Voyage',
    appleMusicSong: 'voyage/1798658924?i=1798658925',
    country: { upsert: { name: 'CH' } }, // Switzerland (Host)
    ddi: { final: '05' }, // Pre-qualified
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/1_HR_O7A4734.jpg?h=85cff267&itok=m8rruZYu',
        selvaId: 'CH',
      },
    },
  },
  {
    name: 'Ziferblat',
    lyrics: lyrics.UA, // Lyrics TBD
    song: 'Bird of Pray',
    appleMusicSong: 'bird-of-pray/1790713027?i=1790713344',
    country: { upsert: { name: 'UA' } }, // Ukraine
    ddi: { semi1: '05' },
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/DSC00359.jpg?h=0f39a6c3&itok=r8b0qDNL',
        selvaId: 'UA',
      },
    },
  },
  {
    name: 'Remember Monday',
    lyrics: lyrics.GB, // Lyrics TBD
    song: 'What The Hell Just Happened?',
    appleMusicSong: 'what-the-hell-just-happened/1801314893?i=1801314896',
    country: { upsert: { name: 'GB' } }, // United Kingdom (Big 5)
    ddi: { final: '06' }, // Pre-qualified
    image: {
      upsert: {
        src: 'https://eurovision.tv/sites/default/files/styles/teaser/public/media/image/2025-03/DSC_3336_V2.jpg?h=cae35e29&itok=aKOoqBhd',
        selvaId: 'GB',
      },
    },
  },
]
