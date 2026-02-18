import test from 'ava'
import {
  hash,
  hashCompact,
  hashObject,
  hashObjectIgnoreKeyOrder,
} from '../src/index.js'

test('hash null (top level)', async (t) => {
  t.is(hash(null), 0)
})

test('hash toJSON (top level)', async (t) => {
  const bla = new Date(100)
  t.true(hash(bla) > 0)
  const bla2 = new Date(200)
  t.not(hash(bla2), hash(bla))
})

test('hash toJSON', async (t) => {
  const bla = {
    x: {
      bla: new Date(100),
    },
  }
  t.true(hash(bla) > 0)
  const bla2 = {
    x: {
      bla: new Date(200),
    },
  }
  t.not(hash(bla2), hash(bla))
})

test('hash', async (t) => {
  const a = { x: true }
  t.true(hash(a) > 0)
  const bla = {
    x: {
      bla: 'x',
    },
  }
  t.true(hash(bla) > 0)
})

test('hash array', async (t) => {
  const a: number[] = [1, 2, 3, 4, 5, 6]
  const x = hashObject(a)
  const prevs: any[] = []
  const set: { [key: string]: string } = {}
  prevs.push(set)
  let cnt = 0
  while (cnt < 1e6) {
    const randoArray: number[] = []
    for (let i = 0; i < 6; i++) {
      randoArray.push(Math.floor(Math.random() * 10))
    }
    const x = hashObject(randoArray)
    let str = randoArray.join(',')
    if (set[x] && set[x] !== str) {
      t.fail(`'Colision ${str} '-->', ${set[x]} hash: ${x}`)
    }
    set[x] = str
    cnt++
  }
  t.true(typeof x === 'number')
})

test('hash stress many arrays', async (t) => {
  const a: number[] = []
  for (let i = 0; i < 6; i++) {
    a.push(Math.floor(Math.random() * 10))
  }
  const d = Date.now()
  let x: number = 0
  for (let i = 0; i < 1e6; i++) {
    x = hashObject(a)
  }
  console.info(
    '    1mil hashObject on array object takes',
    Date.now() - d,
    'ms to hash'
  )
  t.true(typeof x === 'number')
})

test('hash stress object with many keys', async (t) => {
  const a: any = {}
  for (let i = 0; i < 1e6; i++) {
    a[(~~(Math.random() * 1000000)).toString(16)] = 'flurpy'
  }
  const d = Date.now()
  const x = hashObject(a)
  console.info('    1mil keys object takes', Date.now() - d, 'ms to hash')
  t.true(typeof x === 'number')
})

test('hash colish', async (t) => {
  const prevs: any[] = []

  let ipCnt = 0
  for (let i = 0; i < 2; i++) {
    const set: { [key: string]: any } = {}
    prevs.push(set)
    let cnt = 0
    while (cnt < 1e6) {
      ipCnt++
      const ip =
        Math.floor(Math.random() * 255) +
        1 +
        '.' +
        Math.floor(Math.random() * 255) +
        '.' +
        Math.floor(Math.random() * 255) +
        '.' +
        Math.floor(Math.random() * 255)

      const x = hash(ip)

      let prev

      for (let j = 0; j < i + 1; j++) {
        prev = prevs[j][x]
        if (prev) {
          break
        }
      }

      if (prev) {
        if (prev !== ip) {
          t.fail(`Colish ${ip} ${prev} hash ${x} #${ipCnt}`)
        }
      }
      cnt++

      set[x] = ip
    }
  }

  t.pass()
})

test('hash  hashObjectIgnoreKeyOrder', async (t) => {
  const a = {
    a: true,
    b: true,
    c: {
      d: true,
      e: true,
    },
  }
  const b = {
    c: {
      e: true,
      d: true,
    },
    b: true,
    a: true,
  }

  t.is(hashObjectIgnoreKeyOrder(a), hashObjectIgnoreKeyOrder(b))
})

test('hash  hashObjectIgnoreKeyOrder large', async (t) => {
  const a = {
    children: [
      {
        type: 'waitingScreen',
        index: 0,
        id: 'wa4ab7e44c',
        disabled: false,
        title: 'Wait # 1',
      },
      {
        type: 'welcomeScreen',
        index: 1,
        id: 'we7e8b4bfc',
        disabled: false,
        title: 'The voting will start soon!',
      },
      {
        type: 'videoScreen',
        index: 2,
        id: 'vi6d2e21ca',
        title: 'Watch the recap first!',
        disabled: false,
        video:
          'https://based-videos-fra.s3.eu-central-1.amazonaws.com/5f9bdb334d7c7d975473bab4413f1d73/5f9bdb334d7c7d975473bab4413f1d73.m3u8',
      },
      {
        type: 'multipleChoice',
        index: 3,
        id: 'mu241ab268',
        disabled: false,
        title: 'Pick 3 of your favorite songs and submit your vote.',
      },
      {
        type: 'thankYouScreen',
        index: 4,
        id: 'thba70c809',
        disabled: false,
        title: 'Thank you for voting!',
      },
    ],
    type: 'edition',
    title: 'JESC 2020',
    ogImage: '',
    id: 'ed936c4793',
    ogTitle: '',
    ogDescription: '',
    aliases: ['jesc'],
    name: '',
    config: {
      logo: 'https://static.junioreurovision.tv/dist/assets/images/jesc_slogan.c6c10aa7dcf40254bf08d7f7f3d65b90.png',
      borderWidth: 0,
      borderRadius: 0,
      logoLink: 'https://hotmail.com',
    },
    logo: '',
    updatedAt: 1605711695555,
    theme: {
      buttonText: 'rgb(245,245,245)',
      highlight: 'rgb(49,130,206)',
      backgroundImage:
        'https://based-images.imgix.net/c37e075134b55505f28fc28c7c21536c.png',
      background: 'rgb(17,11,87)',
      itemBackground: 'rgb(252,252,252)',
      itemText: 'rgb(0,0,0)',
      text: 'rgb(254,255,254)',
    },
    companyName: '',
  }

  const b = {
    children: [
      {
        type: 'waitingScreen',
        index: 0,
        id: 'wa4ab7e44c',
        disabled: true,
        title: 'Wait # 1',
      },
      {
        type: 'welcomeScreen',
        index: 1,
        id: 'we7e8b4bfc',
        disabled: false,
        title: 'The voting will start soon!',
      },
      {
        type: 'videoScreen',
        index: 2,
        id: 'vi6d2e21ca',
        title: 'Watch the recap first!',
        disabled: false,
        video:
          'https://based-videos-fra.s3.eu-central-1.amazonaws.com/5f9bdb334d7c7d975473bab4413f1d73/5f9bdb334d7c7d975473bab4413f1d73.m3u8',
      },
      {
        type: 'multipleChoice',
        index: 3,
        id: 'mu241ab268',
        disabled: false,
        title: 'Pick 3 of your favorite songs and submit your vote.',
      },
      {
        type: 'thankYouScreen',
        index: 4,
        id: 'thba70c809',
        disabled: false,
        title: 'Thank you for voting!',
      },
    ],
    type: 'edition',
    title: 'JESC 2020',
    ogImage: '',
    id: 'ed936c4793',
    ogTitle: '',
    ogDescription: '',
    aliases: ['jesc'],
    name: '',
    config: {
      logo: 'https://static.junioreurovision.tv/dist/assets/images/jesc_slogan.c6c10aa7dcf40254bf08d7f7f3d65b90.png',
      borderWidth: 0,
      borderRadius: 0,
      logoLink: 'https://hotmail.com',
    },
    logo: '',
    updatedAt: 1605711695555,
    theme: {
      buttonText: 'rgb(245,245,245)',
      highlight: 'rgb(49,130,206)',
      backgroundImage:
        'https://based-images.imgix.net/c37e075134b55505f28fc28c7c21536c.png',
      background: 'rgb(17,11,87)',
      itemBackground: 'rgb(252,252,252)',
      itemText: 'rgb(0,0,0)',
      text: 'rgb(254,255,254)',
    },
    companyName: '',
  }

  const x = hashObjectIgnoreKeyOrder(a)
  const y = hashObjectIgnoreKeyOrder(b)

  t.true(x !== y)
})

test('hash  hashObjectIgnoreKeyOrder large 2', async (t) => {
  const a = {
    children: [
      {
        type: 'waitingScreen',
        index: 0,
        id: 'wa4ab7e44c',
        disabled: false,
        title: 'Wait # 1',
      },
      {
        type: 'welcomeScreen',
        index: 1,
        id: 'we7e8b4bfc',
        disabled: false,
        title: 'The voting will start soon!',
      },
      {
        type: 'videoScreen',
        index: 2,
        id: 'vi6d2e21ca',
        title: 'Watch the recap first!',
        disabled: false,
        video:
          'https://cdn.based.io/ef728d8a807067f2e73591d4850c5f8a/ef728d8a807067f2e73591d4850c5f8a.m3u8',
      },
      {
        type: 'multipleChoice',
        index: 3,
        id: 'mu241ab268',
        disabled: false,
        title: 'Pick 3 of your favorite songs and submit your vote.',
      },
      {
        type: 'thankYouScreen',
        index: 4,
        id: 'thba70c809',
        disabled: false,
        title: 'Thank you for voting!',
      },
    ],
    type: 'edition',
    title: 'JESC 2020',
    ogImage: '',
    id: 'ed936c4793',
    ogTitle: '',
    ogDescription: '',
    aliases: ['jesc'],
    name: '',
    config: {
      logo: 'https://static.junioreurovision.tv/dist/assets/images/jesc_slogan.c6c10aa7dcf40254bf08d7f7f3d65b90.png',
      borderWidth: 0,
      borderRadius: 0,
      logoLink: 'https://hotmail.com',
    },
    logo: '',
    updatedAt: 1605711695555,
    theme: {
      buttonText: 'rgb(245,245,245)',
      highlight: 'rgb(49,130,206)',
      backgroundImage:
        'https://based-images.imgix.net/c37e075134b55505f28fc28c7c21536c.png',
      background: 'rgb(17,11,87)',
      itemBackground: 'rgb(252,252,252)',
      itemText: 'rgb(0,0,0)',
      text: 'rgb(254,255,254)',
    },
    companyName: '',
  }

  const b = {
    children: [
      {
        type: 'waitingScreen',
        index: 0,
        id: 'wa4ab7e44c',
        disabled: true,
        title: 'Wait # 1',
      },
      {
        type: 'welcomeScreen',
        index: 1,
        id: 'we7e8b4bfc',
        disabled: false,
        title: 'The voting will start soon!',
      },
      {
        type: 'videoScreen',
        index: 2,
        id: 'vi6d2e21ca',
        title: 'Watch the recap first!',
        disabled: false,
        video:
          'https://cdn.based.io/ef728d8a807067f2e73591d4850c5f8a/ef728d8a807067f2e73591d4850c5f8a.m3u8',
      },
      {
        type: 'multipleChoice',
        index: 3,
        id: 'mu241ab268',
        disabled: false,
        title: 'Pick 3 of your favorite songs and submit your vote.',
      },
      {
        type: 'thankYouScreen',
        index: 4,
        id: 'thba70c809',
        disabled: false,
        title: 'Thank you for voting!',
      },
    ],
    type: 'edition',
    title: 'JESC 2020',
    ogImage: '',
    id: 'ed936c4793',
    ogTitle: '',
    ogDescription: '',
    aliases: ['jesc'],
    name: '',
    config: {
      logo: 'https://static.junioreurovision.tv/dist/assets/images/jesc_slogan.c6c10aa7dcf40254bf08d7f7f3d65b90.png',
      borderWidth: 0,
      borderRadius: 0,
      logoLink: 'https://hotmail.com',
    },
    logo: '',
    updatedAt: 1605711695555,
    theme: {
      buttonText: 'rgb(245,245,245)',
      highlight: 'rgb(49,130,206)',
      backgroundImage:
        'https://based-images.imgix.net/c37e075134b55505f28fc28c7c21536c.png',
      background: 'rgb(17,11,87)',
      itemBackground: 'rgb(252,252,252)',
      itemText: 'rgb(0,0,0)',
      text: 'rgb(254,255,254)',
    },
    companyName: '',
  }

  const x = hashObjectIgnoreKeyOrder(a)
  const y = hashObjectIgnoreKeyOrder(b)

  t.true(x !== y)
})

const large = {
  type: 'multipleChoice',
  disabled: false,
  children: [
    {
      name: '',
      subtitle: "J'imagine",
      description:
        "Valentina was internally selected by FranceTV to represent her country at the Junior Eurovision Song Contest 2020, following in the footsteps of Carla (2019), Angélina (2018) and Thomas (2004).\n\nValentina was brought up in a musical environment. Her mother, an Italian teacher, used to sing sweet lullabies and ever since, Valentina has an unconditional love for singing.\n\nIn 2018, she stood out at the 'Kids United Nouvelle Génération' audition and successfully joined another four singers on an exciting journey. She quickly became the 'Kids United Nouvelle Génération' mascot, developing an impressive community of fans on social media of almost 300.000 followers.\n\nShe has recorded two albums with the group, participates in UNICEF missions and takes part in various collective projects with other artists.\nValentina knows what she wants and is not afraid to show it. However, she remains down to earth.\n\nEven though Ariana Grande is her biggest idol, Valentina often surprises her fans with her keen interest in French rap. Not only does she sing and rap in French, she also has a talent for singing in Italian. She especially enjoys singing Laura Pausini's songs, given that her mother is a fan.\n",
      title: 'Valentina',
      id: 'op21411d72',
      index: 66,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/8595cea0ed4382d3c42b12aa1739e105.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video:
        'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    },
    {
      name: '',
      subtitle: 'You Are Not Alone',
      description:
        'Georgia participated in Junior Eurovision every year since their debut in 2007, when the contest was held in Rotterdam, in The Netherlands.',
      title: 'Sandra Gadelia',
      id: 'op3ac496e1',
      index: 98,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/73803e8b4760aab2f601dfd0f606e606.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'Stronger with you',
      description:
        "After an initial shortlisting process bringing 70 hopefuls down to just five, Susan won 'KiKA LIVE: Junior Eurovision Song Contest – Das Casting'. The 13-year-old singer will perform 'Stronger With You' as the country's first representative at the Junior Eurovision Song Contest. \n\nBerlin-based Susan impressed a professional casting jury in Germany’s national selection show, consisting of music producer Martin Haas, show and vocal coach Michele Huesmann, Max Mutzke, who represented Germany at the Eurovision Song Contest in 2004 and Levent Geiger - last year's finalist of the songwriter competition Dein Song (ZDF) and composer of year’s JESC entry.\n\nSusan was filled with joy and excitement following her win: \"Since I was little, it has always been my dream to take part in the Eurovision Song Contest. It is all the more exciting that I am now allowed to represent Germany at Junior Eurovision. I hope that I can make my country and the people who stand behind me proud.\"",
      title: 'Susan',
      id: 'op3da6f795',
      index: 4,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/0668fbf1288e3d1cc4354a9fc884a94f.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'Chasing Sunsets',
      description:
        'Chanel was born in 2011 and lives in Mosta. From an early age, she has shown a great passion for singing. Her first singing and music theory lessons were just three years ago and she’s always showed interest in learning the piano, so she added piano lessons to her schedule last year. \n\nShe’s participated in various local competitions where she was always praised and encouraged to keep on nourishing her talent. In December 2019, she was named ‘Best Singer of The Year’ in a local competition.\n\nIn 2018 she participated in her first-ever international competition in Lithuania, Music Talent League, achieving the 1st place in her age group. Last year she also had the opportunity to participate in Talent World Contest (Italy) and in Riga Symphony (Latvia) placing 1st in both competitions, only a few marks away from winning the Grand Prix award.\n\nChanel is looking forward to representing PBS Malta in this year’s Junior Eurovision Song Contest final with her first original song: Chasing Sunsets.',
      title: 'Chanel Monseigneur',
      id: 'op65080f1b',
      index: 1,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/eee2ea98f51a77547d55970cf7ea7bb3.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: "I'll Be Standing",
      description:
        'Alicja, representing host broadcaster TVP, lives in the small town of Stojeszyn Pierwszy (Lublin Province) with her parents and sister. She has a cat called Lili and loves to dance and travel. She has represented Poland at international competitions in Malta, Bulgaria and Italy. Alicja is very fond of exercise - inline skating, electric boarding, cycling, riding her scooter and rope climbing. Recently she has discovered a new passion - horse riding. \n\nIn May she released her debut single, a duet with her sister.\n\nAlicja took part in The Voice Kids III. She reached the final nine of the competition in one of the trainers’ teams.',
      title: 'Ala Tracz',
      id: 'op6e32b8e2',
      index: 2,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/dfefba2598a5c943646d05643847640f.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'Heartbeat',
      description:
        'Petar Aničić was selected to represent Serbia with the song \'Heartbeat\' following a review of entries by an expert jury at Serbia\'s public broadcaster RTS.\n\nPetar Aničić was born in 2006 and started making music at the age of four. When he was six, he enrolled in the Mokranjac Junior Music School in Belgrade and, only one year later, he composed his first piece called I Run Fast. Petar has performed at numerous concerts and contests where he’s won several awards.\n\nIn addition to music, Petar’s interests include history, geography, languages and sports. Besides singing and playing the piano, he practices rowing and would recommend it to everyone "because of the calming effect of the water and the fact that rowing helps develop both physical and mental strength." He likes to be around positive, cheerful, extrovert and funny people.\n\nPetar is very excited to represent Serbia: "It is a great challenge and an excellent opportunity to showcase my talent and represent my country in the best possible way."',
      title: 'Petar Aničić',
      id: 'op8dbfcddc',
      index: 5,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/9f54448c1fa72f1c3d9120d68e4c6ffc.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'Vidkryvai (Open Up)',
      description:
        "Oleksandr Balabanov will represent Ukraine (UA:PBC) at the 18th Junior Eurovision Song Contest.\n\nHe was born in Donetsk and has been keen on singing from an early age. Aged four, Oleksandr was a member of a children's folk singing group. When he was eight, he moved with his family to Kyiv where he started taking singing classes and entered the music department of an arts school. He is fluent in English and studies German and Turkish.\n\nOleksandr was one of 11 shortlisted participants in his country’s national final. His victory was decided by both jury and online voting. ",
      title: 'Oleksandr Balabanov',
      id: 'op97385db8',
      index: 8,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/217042541a3b6fb3fbae049811a90857.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: 'an alias',
      video: '',
    },
    {
      name: '',
      subtitle: 'Palante',
      description:
        'Soleá Fernandez Moreno was born in Sevilla in 2011 and comes from one of the most important flamenco families in Spain: the Farruco.\n\nHer enthusiasm for singing and dancing stood out since she was little and she made her debut in a family show at the popular La Maestranza theatre.\n\nWhen Soleá was only 4 years old, she was the star of a Christmas show, Navidad En Familia, where she made her debut as an actress and dancer.\n\nRepresenting Spain (RTVE) at the Junior Eurovision Song Contest is "a dream come true" she said: "It is everything, it is incredible to perform on this stage and for so many people."',
      title: 'Soleá',
      id: 'op9a204ff9',
      index: 6,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/9423dfd90badaa1867c73abd77279229.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'Forever',
      description:
        "Karakat Bashanova is 12-years-old and comes from Ryskulov in the Almaty region.\nShe started singing at the age of five and enrolled in formal courses aged nine. She then began to practice vocals from singers on YouTube. Karakat is now enrolled at the music school of the Russian National Academy of Music named after famed Khazak opera singer, Kulyash Baiseitova, where she plays the piano and violin.\nKarakat has already many accolades to her name. She has participated in several singing contests in the region. She was a finalist in 'The Voice of Children 2018' and also took 3rd place at the open children's vocal festival 'Happy Child 2019'.\nKarakat has dedicated her song “Forever” to her father. The song, submitted by Khabar Agency, was written by Khamit Shangaliyev, the same composer who wrote Yerzhan Maxim’s song for the Junior Eurovision Song Contest last year.",
      title: 'Karakat Bashanova',
      id: 'opa277b3f4',
      index: 0,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/5eaf7d47762e21a7a916fd5bf4ca5121.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'My New Day',
      description:
        'Sofia Feskova is Russia’s 16th participant at the Junior Eurovision Song Contest. 11-year-old Sofia from St. Petersburg won RTR’s national selection in late September.\n\nShe will perform her song Moy Novy Den (My New Day) at JESC 2020. She says the lyrics are very special: "The meaning of the song is that one should never give up, keep going and fill every day with generosity and happiness".',
      title: 'Sofia Feskova',
      id: 'opab31ddc5',
      index: 3,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/492977a0af3be0305e850c19feacb008.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
    {
      name: '',
      subtitle: 'Aliens',
      description:
        "Arina Pehtereva was selected internally by Belarusian broadcaster BTRC to represent her country with the song 'Aliens'.\n\nArina Pehtereva was born in 2008 in Mogilev. She’s been a music fan from a young age and started taking vocal lessons at six-years-old. Arina has taken part in - and won! - many national and international vocal competitions and festivals since 2014. She also took part in 'The Voice Kids' and has repeatedly been a finalist in Belarus' national selection for the Junior Eurovision Song Contest.\n\nArina says Aliens was written in spring when the coronavirus spread around the world: \n\n\"The idea of my song is simple: The world has stopped, borders have closed, people can no longer visit each other and even JESC 2020 is different. But I believe that the future is in our hands, and it is up to us children to save the world and make it better!\"",
      title: 'Arina Pehtereva',
      id: 'opbc54a3d6',
      index: 999,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/abf7c24ab0f52d0267996c363f204efb.jpeg',
      ogTitle: '',
      ddi: 77,
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: 'arina',
      video:
        'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    },
    {
      name: '',
      subtitle: 'Best Friends',
      description:
        "Unity is a girl-group made up of members Naomi (13), Maud (14), Jayda (13) and Demi (14).\n\nUnity were selected in AVROTROS’ Junior Songfestival 2020 and will perform the song Best Friends in JESC 2020. All four members have a rich musical history for their ages.\n\nJayda has been part of Kinderen voor Kinderen, a Dutch children's choir, and has been dancing and singing since she was very young.\n\nDemi, who couldn't participate in the national final live show, won a platinum record when she was part of Kinderen voor Kinderen, went to theatre school when she was six and played Pippi Longstocking in a local musical.\n\nMaud started guitar lessons when she was eight and has since attended a music academy. She also took part in The Voice Kids in the Netherlands.\n\nNaomi started performing in musicals when she was seven and has been singing in church for many years now.",
      title: 'Unity',
      id: 'ope8f83cd6',
      index: 7,
      ogDescription: '',
      aliases: [],
      type: 'option',
      image:
        'https://based-images.imgix.net/e4638878024a666bbc0a37370b984961.jpeg',
      ogTitle: '',
      caption:
        '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
      ogImage: '',
      alias: '',
      video: '',
    },
  ],
  imageEnabled: false,
  title: 'Choisissez vos 3 chansons préférées et validez votre vote.',
  id: 'mu241ab268',
  aliases: [],
  buttonText: 'Validez vos votes',
  image: '',
  index: 3,
  name: 'Multiple Choice',
  description: '',
  alias: '',
  settings: {
    rangeMin: 3,
    rangeMax: 3,
  },
}

test('hash  hashObjectIgnoreKeyOrder large 3.1', async (t) => {
  for (let i = 0; i < 10000; i++) {
    const a = { ...large }
    const b = large
    a.description = (~~(Math.random() * 999999999999)).toString(16)
    const x = hashObjectIgnoreKeyOrder(a)
    const y = hashObjectIgnoreKeyOrder(b)
    t.true(x !== y)
  }
})

test('hash  hashObjectIgnoreKeyOrder large 3', async (t) => {
  const a = {
    type: 'multipleChoice',
    disabled: false,
    children: [
      {
        name: '',
        subtitle: 'Best Friends',
        // description is totally different
        description: 'nothing',
        title: 'Unity',
        id: 'ope8f83cd6',
        index: 7,
        ogDescription: '',
        aliases: [],
        type: 'option',

        ogTitle: '',
        caption:
          '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
        ogImage: '',
      },
    ],
    imageEnabled: false,
    title: 'Choisissez vos 3 chansons préférées et validez votre vote.',
    id: 'mu241ab268',
    aliases: [],
    buttonText: 'Validez vos votes',
    image: '',
    index: 3,
    name: 'Multiple Choice',
    description: '',
  }

  const b = {
    type: 'multipleChoice',
    disabled: false,
    children: [
      {
        name: '',
        subtitle: 'Best Friends',
        // description is totally different
        description:
          "Unity is a girl-group made up of members Naomi (13), Maud (14), Jayda (13) and Demi (14).\n\nUnity were selected in AVROTROS’ Junior Songfestival 2020 and will perform the song Best Friends in JESC 2020. All four members have a rich musical history for their ages.\n\nJayda has been part of Kinderen voor Kinderen, a Dutch children's choir, and has been dancing and singing since she was very young.\n\nDemi, who couldn't participate in the national final live show, won a platinum record when she was part of Kinderen voor Kinderen, went to theatre school when she was six and played Pippi Longstocking in a local musical.\n\nMaud started guitar lessons when she was eight and has since attended a music academy. She also took part in The Voice Kids in the Netherlands.\n\nNaomi started performing in musicals when she was seven and has been singing in church for many years now.",
        title: 'Unity',
        id: 'ope8f83cd6',
        index: 7,
        ogDescription: '',
        aliases: [],
        type: 'option',

        ogTitle: '',
        caption:
          '<img style="display:inline;margin-bottom:-5px;" src="https://based-images.imgix.net/ae51fab48e15810ed338fc774064cb26.png" width="20px"/> Belarus',
        ogImage: '',
      },
    ],
    imageEnabled: false,
    title: 'Choisissez vos 3 chansons préférées et validez votre vote.',
    id: 'mu241ab268',
    aliases: [],
    buttonText: 'Validez vos votes',
    image: '',
    index: 3,
    name: 'Multiple Choice',
    description: '',
  }

  const x = hashObjectIgnoreKeyOrder(a)
  const y = hashObjectIgnoreKeyOrder(b)

  t.true(x !== y)
})

test('hash  hashObjectIgnoreKeyOrder large 4', async (t) => {
  const a = {
    children: [
      {
        type: 'waitingScreen',
        index: 0,
        id: 'wa4ab7e44c',
        disabled: true,
        title: 'Wait # 1',
      },
      {
        type: 'welcomeScreen',
        index: 1,
        id: 'we7e8b4bfc',
        disabled: false,
        title: 'The voting will start soon!',
      },
      {
        type: 'videoScreen',
        index: 2,
        id: 'vi6d2e21ca',
        title: 'Watch the recap first!',
        disabled: false,
        video:
          'https://cdn.based.io/ef728d8a807067f2e73591d4850c5f8a/ef728d8a807067f2e73591d4850c5f8a.m3u8',
      },
      {
        type: 'multipleChoice',
        index: 3,
        id: 'mu241ab268',
        disabled: false,
        title: 'Pick 3 of your favorite songs and submit your vote.',
      },
      {
        type: 'thankYouScreen',
        index: 4,
        id: 'thba70c809',
        disabled: false,
        title: 'Thank you for voting!',
      },
    ],
    companyName: '',
    ogTitle: '',
    type: 'edition',
    id: 'ed936c4793',
    name: '',
    ogDescription: '',
    aliases: ['jesc'],
    title: 'JESC 2020',
    config: {
      borderRadius: 0,
      logoLink: 'https://hotmail.com',
      logo: 'https://static.junioreurovision.tv/dist/assets/images/jesc_slogan.c6c10aa7dcf40254bf08d7f7f3d65b90.png',
      borderWidth: 0,
      roundId: 0,
    },
    logo: '',
    ogImage: '',
    startTime: 1606086000000,
    theme: {
      buttonText: 'rgb(245,245,245)',
      highlight: 'rgb(49,130,206)',
      background: 'rgb(17,11,87)',
      itemBackground: 'rgb(252,252,252)',
      text: 'rgb(254,255,254)',
      backgroundImage:
        'https://based-images.imgix.net/c37e075134b55505f28fc28c7c21536c.png',
      itemText: 'rgb(0,0,0)',
    },
    updatedAt: 1606159265527,
  }

  const b = {
    children: [
      {
        type: 'waitingScreen',
        index: 0,
        id: 'wa4ab7e44c',
        disabled: true,
        title: 'Wait # 1',
      },
      {
        type: 'welcomeScreen',
        index: 1,
        id: 'we7e8b4bfc',
        disabled: true,
        title: 'The voting will start soon!',
      },
      {
        type: 'videoScreen',
        index: 2,
        id: 'vi6d2e21ca',
        title: 'Watch the recap first!',
        disabled: false,
        video:
          'https://cdn.based.io/ef728d8a807067f2e73591d4850c5f8a/ef728d8a807067f2e73591d4850c5f8a.m3u8',
      },
      {
        type: 'multipleChoice',
        index: 3,
        id: 'mu241ab268',
        disabled: false,
        title: 'Pick 3 of your favorite songs and submit your vote.',
      },
      {
        type: 'thankYouScreen',
        index: 4,
        id: 'thba70c809',
        disabled: false,
        title: 'Thank you for voting!',
      },
    ],
    companyName: '',
    ogTitle: '',
    type: 'edition',
    id: 'ed936c4793',
    name: '',
    ogDescription: '',
    aliases: ['jesc'],
    title: 'JESC 2020',
    config: {
      borderRadius: 0,
      logoLink: 'https://hotmail.com',
      logo: 'https://static.junioreurovision.tv/dist/assets/images/jesc_slogan.c6c10aa7dcf40254bf08d7f7f3d65b90.png',
      borderWidth: 0,
      roundId: 0,
    },
    logo: '',
    ogImage: '',
    startTime: 1606086000000,
    theme: {
      buttonText: 'rgb(245,245,245)',
      highlight: 'rgb(49,130,206)',
      background: 'rgb(17,11,87)',
      itemBackground: 'rgb(252,252,252)',
      text: 'rgb(254,255,254)',
      backgroundImage:
        'https://based-images.imgix.net/c37e075134b55505f28fc28c7c21536c.png',
      itemText: 'rgb(0,0,0)',
    },
    updatedAt: 1606159265527,
  }

  const x = hashObjectIgnoreKeyOrder(a)
  const y = hashObjectIgnoreKeyOrder(b)

  t.true(x !== y)
})

test('hash stress hashObjectIgnoreKeyOrder', async (t) => {
  const a: any = {}

  for (let i = 0; i < 1000000; i++) {
    a[(~~(Math.random() * 1000000)).toString(16)] = 'flurpy'
  }

  const d = Date.now()
  const x = hashObjectIgnoreKeyOrder(a)

  console.info(
    '    1mil keys object takes',
    Date.now() - d,
    'ms to hash ignore key order'
  )

  t.true(typeof x === 'number')
})

test('hash test equality 1', async (t) => {
  const a = {
    type: 'folder',
    title: '',
    id: 'fo1',
    name: '',
    children: [
      {
        buttonText: 'my ballz',
        type: 'match',
        name: '',
        id: 'ma1',
        aliases: [],
        published: false,
      },
    ],
    aliases: [],
  }
  const b = {
    type: 'folder',
    title: '',
    id: 'fo1',
    name: '',
    children: [
      {
        buttonText: 'my ballzzzz',
        type: 'match',
        name: '',
        id: 'ma1',
        aliases: [],
        published: false,
      },
    ],
    aliases: [],
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash test equality 2', async (t) => {
  const a = {
    type: 'folder',
    title: '',
    id: 'fo1',
    name: '',
    children: [
      {
        buttonText: 'my b',
        type: 'match',
        name: '',
        id: 'ma1',
        aliases: [],
        published: false,
      },
    ],
    aliases: [],
  }
  const b = {
    type: 'folder',
    title: '',
    id: 'fo1',
    name: '',
    children: [
      {
        buttonText: 'my ba',
        type: 'match',
        name: '',
        id: 'ma1',
        aliases: [],
        published: false,
      },
    ],
    aliases: [],
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash test equality 3', async (t) => {
  const a = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'my b',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }
  const b = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'my ba',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash test equality 4', async (t) => {
  const a = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'a',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }
  const b = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'aa',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash test equality 5', async (t) => {
  const a = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'aa',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }
  const b = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'aax',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash test equality 6', async (t) => {
  const a = {
    buttonText: 'aax',
  }
  const b = {
    buttonText: 'b',
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash test equality 7', async (t) => {
  const a = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: 'a',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }
  const b = {
    type: 'videoScreen',
    index: 0,
    id: '309aa290aa',
    video: '',
    buttonText: '',
    image: '',
    title: 'my',
    description: '',
    name: 'Video Screen',
    aliases: [],
    children: [],
    videoMandatory: false,
  }

  const hashA1 = hashObject(a)
  const hashB1 = hashObject(b)

  const hashA = hashObjectIgnoreKeyOrder(a)
  const hashB = hashObjectIgnoreKeyOrder(b)

  t.true(hashA1 !== hashB1)
  t.true(hashA !== hashB)
})

test('hash fixed length', async (t) => {
  const texts: any[] = []
  for (let i = 0; i < 10000; i++) {
    const nr = Math.random() * 100
    texts[i] =
      nr < 33
        ? {
            blxxxa: ~~(Math.random() * 100 * 10000).toString(16),
            bla: ~~(Math.random() * 100 * 10000).toString(16),
          }
        : nr < 66
        ? (Math.random() * 100 * 10000).toString(16)
        : (Math.random() * 100000 * 10000).toString(16)
  }

  for (let i = 0; i < 10; i++) {
    const bla = texts[i]
    const x = hash(bla, 15)
    const y = hashCompact(bla, 9)
    const a = hashCompact(
      ['x', 'bla bla', 'snurkypatbs do it', { lifestyle: true }],
      10
    )
    const z = hashCompact(bla, 6)
    const blap = hashCompact(
      ['x', 'bla bla', 'snurkypatbs do it', { lifestyle: true }],
      20
    )
    const blurp = hashCompact(['x', 'bla bla', 'snurkypatbs do it'], 10)

    t.is(x.toString().length, 15)
    t.is(y.length, 9)
    t.is(a.length, 10)
    t.is(z.length, 6)
    t.is(blap.length, 20)
    t.is(blurp.length, 10)
  }
})

test('hash fixed length ignore key order', async (t) => {
  const a = hashCompact(
    {
      x: 1,
      y: 2,
      z: 'flapper',
    },
    10,
    true
  )

  const b = hashCompact(
    {
      z: 'flapper',
      x: 1,
      y: 2,
    },
    10,
    true
  )

  t.is(a, b)
})

test('hash ingore key order test collision', async (t) => {
  const arr: [string, { myQuery: number }][] = []
  for (let i = 0; i < 1e6; i++) {
    arr.push([
      'counter',
      {
        myQuery: i,
      },
    ])
  }
  const unique: Set<number> = new Set()
  const negative: Set<number> = new Set()
  let i = 0
  for (const o of arr) {
    i++
    const x = hashObjectIgnoreKeyOrder(o)
    if (unique.has(x)) {
      t.fail(`Hash collision! ${x} @ number ${i}`)
    }
    if (x < 0) {
      negative.add(x)
    }
  }
  t.pass('No collision in 1m items')

  t.is(negative.size, 0)
})
