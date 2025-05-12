export const countries = [
  // Albania
  {
    displayName: 'Albania',
    name: 'AL',
    voteType: 'sms_text',
    maxVotes: 20,
    price: 12000,
    currency: 'all',
    destination: '54345',
    broadcaster: 'Radio Televizioni Shqiptar (RTSH)',
    privacyUrl:
      'https://festivali.rtsh.al/artikull/njoftim-per-privatesine-e-televotimit-ne-konkursin-e-kenges-ne-eurovizion-2024',
    votingText: 'Dërgo SMS tek 54345 me tekst %@',
    votingLegal: 'Çdo SMS kushton 120 lekë (me TVSH)',
    languages: {
      upsert: [{ iso: 'sq' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Armenia
  {
    displayName: 'Armenia',
    name: 'AM',
    voteType: 'sms_text',
    maxVotes: 20,
    price: 15000,
    currency: 'amd',
    destination: '1004',
    broadcaster: 'Հայաստանի հանրային հեռուստաընկերություն (1TV)',
    privacyUrl: 'https://www.eurovision.am/hy/eurovision/data',
    votingText: 'նախընտրած մասնակցի համարը 1004 կարճ համարին  %@',
    votingLegal: 'Մեկ SMS-ի արժեքը 150 ՀՀ դրամ է՝ ներառյալ ԱԱՀ',
    languages: {
      upsert: [{ iso: 'hy' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Austria
  {
    displayName: 'Austria',
    name: 'AT',
    voteType: 'sms_suffix',
    maxVotes: 20,
    price: 50,
    currency: 'eur',
    destination: '090105025',
    broadcaster: 'Österreichischer Rundfunk (ORF)',
    privacyUrl: 'https://www.mein.orf.at/austrianentry/',
    votingText: 'SMS an 0901 050 25%@%@',
    votingLegal: '0,50€ / SMS',
    languages: {
      upsert: [{ iso: 'de' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Australia
  {
    displayName: 'Australia',
    name: 'AU',
    voteType: 'online',
    maxVotes: 20,
    price: 70,
    currency: 'aud',
    destination: 'www.esc.vote',
    broadcaster: 'Special Broadcasting Service (SBS)',
    privacyUrl:
      'https://www.sbs.com.au/whats-on/article/privacy-notice-for-the-paid-online-voting-of-the-2024-eurovision-song-contest/af852i8rd',
    votingText: 'Go to www.esc.vote to vote',
    votingLegal:
      "1 vote = $0.70. Limit of 20 votes per Payment method.\nTerms & Conditions apply - full T&C's available at www.esc.vote.",
    languages: {
      upsert: [{ iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Azerbaijan
  {
    displayName: 'Azerbaijan',
    name: 'AZ',
    voteType: 'online',
    maxVotes: 20,
    price: 80,
    currency: 'azn',
    destination: 'www.esc.vote',
    broadcaster: 'İctimai',
    privacyUrl: 'http://itv.az/eurovision/news/47',
    votingText: 'Onlayn səs verin: www.esc.vote',
    votingLegal: 'Bir səs üçün qiymət 0,80 AZN',
    languages: {
      upsert: [{ iso: 'az' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Belgium
  {
    displayName: 'Belgium',
    name: 'BE',
    voteType: 'online',
    maxVotes: 20,
    price: 75,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'VRT (Nederlands); RTBF (Français)',
    privacyUrl:
      'https://www.vrt.be/vrtmax/artikels/2022/05/10/hoe-kan-je-stemmen-voor-het-eurovisiesongfestival/; https://www.rtbf.be/article/eurovision2024-comment-voter-pour-votre-candidatfavori-11359477',
    votingText: 'Stem online op www.esc.vote',
    votingLegal:
      '€ 0,75 per online stem\nZie website voor algemene voorwaarden en privacy',
    languages: {
      upsert: [{ iso: 'nl' }, { iso: 'fr' }, { iso: 'de' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Switzerland
  {
    displayName: 'Switzerland',
    name: 'CH',
    voteType: 'online',
    maxVotes: 20,
    price: 120,
    currency: 'chf',
    destination: 'www.esc.vote',
    broadcaster:
      'Schweizer Radio und Fernsehen (SRF, Deutsch); Radio Télévision Suisse (RTS, Français); Radiotelevisione svizzera di lingua italiana (RSI, Italiano)',
    privacyUrl:
      'https://www.srf.ch/sendungen/eurovision-song-contest/rechtliches-datenschutzhinweise-fuers-kostenpflichtige-onlinevoting-esc-2024; https://www.rsi.ch/musica/Informativa-sulla-protezione-dei-dati-per-la-partecipazione-al-televoto-e-Voto-Online-per-l%E2%80%99Eurovision-Song-Contest--1813913.html',
    votingText: 'Online abstimmen unter www.esc.vote',
    votingLegal: 'CHF 1.20/Online',
    languages: {
      upsert: [{ iso: 'de' }, { iso: 'fr' }, { iso: 'it' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Cyprus
  {
    displayName: 'Cyprus',
    name: 'CY',
    voteType: 'online',
    maxVotes: 20,
    price: 101,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Ραδιοφωνικό Ίδρυμα Κύπρου (CyBC)',
    privacyUrl: 'https://corporate.rik.cy/eurovision-2024-privacy-policy/',
    votingText: 'Online στο www.esc.vote',
    votingLegal: '€1,01/διαδικτυακά',
    languages: {
      upsert: [{ iso: 'el' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Czechia
  {
    displayName: 'Czechia',
    name: 'CZ',
    voteType: 'online',
    maxVotes: 20,
    price: 1300,
    currency: 'czk',
    destination: 'www.esc.vote',
    broadcaster: 'Česká televize (ČT)',
    privacyUrl:
      'https://www.ceskatelevize.cz/porady/10000000484-eurovision-song-contest/13794-pravidla-hlasovani/',
    votingText: 'Hlasujte online na www.esc.vote',
    votingLegal: 'Cena za online hlas 13 Kč včetně DPH.',
    languages: {
      upsert: [{ iso: 'cs' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Germany
  {
    displayName: 'Germany',
    name: 'DE',
    voteType: 'online',
    maxVotes: 20,
    price: 20,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Norddeutscher Rundfunk (NDR)',
    privacyUrl:
      'https://www.eurovision.de/news/Datenschutzhinweise-fuer-das-Televoting-Eurovision-Song-Contest-2024,datenschutz804.html',
    votingText: 'Online abstimmen unter www.esc.vote',
    votingLegal: '0,20 €/Online',
    languages: {
      upsert: [{ iso: 'de' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Denmark
  {
    displayName: 'Denmark',
    name: 'DK',
    voteType: 'online',
    maxVotes: 20,
    price: 100,
    currency: 'dkk',
    destination: 'www.esc.vote',
    broadcaster: 'Danmarks Radio (DR)',
    privacyUrl:
      'https://www.dr.dk/event/melodigrandprix/beskyttelse-af-personoplysninger-ifm-deltagelse-i-afstemning-ved-eurovision-1',
    votingText: 'Gå til www.esc.vote for at stemme',
    votingLegal: '1kr,/online',
    languages: {
      upsert: [{ iso: 'da' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Estonia
  {
    displayName: 'Estonia',
    name: 'EE',
    voteType: 'online',
    maxVotes: 20,
    price: 140,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Eesti Rahvusringhääling (ERR)',
    privacyUrl:
      'https://menu.err.ee/923339/isikuandmete-kaitse-eurovisiooni-lauluvoistluse-telefonihaaletusel',
    votingText: 'Hääletamiseks minge saidile www.esc.vote',
    votingLegal: 'Veebihääletuse hind 1,40 €',
    languages: {
      upsert: [{ iso: 'et' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Spain
  {
    displayName: 'Spain',
    name: 'ES',
    voteType: 'online',
    maxVotes: 20,
    price: 109,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Televisión Española (TVE)',
    privacyUrl:
      'https://www.rtve.es/rtve/20240411/politica-privacidad-eurovision-2024/16055736.shtml',
    votingText: 'Vaya a www.esc.vote para votar',
    votingLegal: 'Coste por voto Online 1,09€ (IVA incl.)',
    languages: {
      upsert: [{ iso: 'es' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Finland
  {
    displayName: 'Finland',
    name: 'FI',
    voteType: 'online',
    maxVotes: 20,
    price: 150,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Yleisradio Oy (Yle)',
    privacyUrl: 'https://yle.fi/a/74-20084576',
    votingText: 'Mene osoitteeseen www.esc.vote äänestääksesi',
    votingLegal: '1,50 €/verkossa',
    languages: {
      upsert: [{ iso: 'fi' }, { iso: 'sv' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // France
  {
    displayName: 'France',
    name: 'FR',
    voteType: 'sms_suffix',
    maxVotes: 20,
    price: 99,
    currency: 'eur',
    destination: '73003',
    broadcaster: 'France Télévisions',
    privacyUrl:
      'https://www.francetelevisions.fr/et-vous/jeux/jeux-tv/eurovision-2021-reglement-et-modalites-du-vote-6203',
    votingText: 'Votez par SMS au 7 3003%@',
    votingLegal: '0,99€ + prix SMS',
    languages: {
      upsert: [{ iso: 'fr' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // United Kingdom
  {
    displayName: 'United Kingdom',
    name: 'GB',
    voteType: 'call_suffix',
    maxVotes: 20,
    price: 15,
    currency: 'gbp',
    destination: '62252',
    broadcaster: 'British Broadcasting Corporation (BBC)',
    privacyUrl:
      'https://www.bbc.co.uk/programmes/articles/4ZhPML769CwJhjcbjrsVDLG/eurovision-song-contest-2024-privacy-notice',
    votingText: 'From mobiles call 6 22 52%@',
    votingLegal:
      "Calls to the short number from your mobile cost 15p. Calls to the long number cost 15p plus your network's access charge. Please ask bill payer’s permission. Terms, privacy notice and more information at bbc.co.uk/eurovision. Please do not vote if you are watching on demand.",
    languages: {
      upsert: [{ iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Georgia
  {
    displayName: 'Georgia',
    name: 'GE',
    voteType: 'sms_text',
    maxVotes: 20,
    price: 140,
    currency: 'gel',
    destination: '95100',
    broadcaster: 'Georgian Public Broadcasting (1TV)',
    privacyUrl:
      'https://1tv.ge/evrovizia-georgia/monacemta-dacva/?fbclid=IwZXh0bgNhZW0CMTAAAR2NDG9ynwHTFFxKBKCKs5b3LAlZQVH9XkikTgROCeRjJlRk_vpEbIODc18_aem_AXx_CKzXri5gYfogtoLBFvZo_RaNiWaNllc2P5enKGYQy9vMCC8ezrbzmHSDs6kdOaMLrBIizmXvT2XgfviSFyt9',
    votingText: 'გააგზავნეთ SMS ნომერზე 95100 მონაწილის ნომრით  %@',
    votingLegal: 'SMS ღირებულება 1,40 დღგ-ს ჩათვლით',
    languages: {
      upsert: [{ iso: 'ka' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Greece
  {
    displayName: 'Greece',
    name: 'GR',
    voteType: 'online',
    maxVotes: 20,
    price: 52,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Ελληνική Ραδιοφωνία Τηλεόραση (EPT)',
    privacyUrl: 'https://eurovision.ert.gr/privacy-notice/',
    votingText: 'Μεταβείτε στη διεύθυνση www.esc.vote για να ψηφίσετε',
    votingLegal: '0,68 ανά online. Συμπεριλαμβάνονται ΦΠΑ 24%',
    languages: {
      upsert: [{ iso: 'el' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Croatia
  {
    displayName: 'Croatia',
    name: 'HR',
    voteType: 'online',
    maxVotes: 20,
    price: 49,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Hrvatska Radiotelevizija (HRT)',
    privacyUrl:
      'https://magazin.hrt.hr/zabava/obavijest-o-televotingu-za-natjecanje-za-pjesmu-eurovizije-2024-11460305',
    votingText: 'Online @ esc.vote',
    votingLegal: '0,49 €/Online PDV uključen.',
    languages: {
      upsert: [{ iso: 'hr' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Ireland
  {
    displayName: 'Ireland',
    name: 'IE',
    voteType: 'online',
    maxVotes: 20,
    price: 60,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Raidió Teilifís Éireann (RTE)',
    privacyUrl:
      'https://www.rte.ie/tv/programme-list/2023/0505/1381007-wwwrteievoting/',
    votingText: 'Go to www.esc.vote to vote',
    votingLegal:
      'Each online vote costs 60c. Full details on www.rte.ie/voting.',
    languages: {
      upsert: [{ iso: 'ga' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Israel
  {
    displayName: 'Israel',
    name: 'IL',
    voteType: 'online',
    maxVotes: 20,
    price: 250,
    currency: 'ils',
    destination: 'www.esc.vote',
    broadcaster: 'כאן (Kan)',
    privacyUrl: 'https://www.kan.org.il/content-pages/privacy_vote_eurovision/',
    votingText: 'www.esc.vote ביישומון כאן להצביע ניתן',
    votingLegal: "עלות ההצבעה 2.50 ש'ח",
    languages: {
      upsert: [{ iso: 'he' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Iceland
  {
    displayName: 'Iceland',
    name: 'IS',
    voteType: 'online',
    maxVotes: 20,
    price: 19400,
    currency: 'isk',
    destination: 'www.esc.vote',
    broadcaster: 'Ríkisútvarpið (RÚV)',
    privacyUrl: 'https://www.ruv.is/songvakeppnin/upplysingar-um-personuvernd',
    votingText: 'Farðu á www.esc.vote til að kjósa',
    votingLegal: 'Atkvæðið kostar 194 kr.',
    languages: {
      upsert: [{ iso: 'is' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Italy
  {
    displayName: 'Italy',
    name: 'IT',
    voteType: 'online',
    maxVotes: 5,
    price: 50,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Radiotelevisione italiana (RAI)',
    privacyUrl:
      'https://www.rai.it/regolamenti/news/2017/04/Eurovision-Song-Contest-7e282c8e-d233-41ff-b55d-f2d9e978578a.html',
    votingText: 'Vai su www.esc.vote per votare',
    votingLegal:
      'Costo 0,50€ a voto. Max 5 voti. Solo maggiorenni. Info pag. 556 Televideo e www.rai.it/eurovisionsongcontest.',
    languages: {
      upsert: [{ iso: 'it' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Lithuania
  {
    displayName: 'Lithuania',
    name: 'LT',
    voteType: 'online',
    maxVotes: 20,
    price: 90,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Lietuvos nacionalinis radijas ir televizija (LRT)',
    privacyUrl: 'https://www.lrt.lt/projektai/eurovizija/balsavimastelefonu',
    votingText: 'Norėdami balsuoti, eikite į www.esc.vote',
    votingLegal: 'Balsavimas internetu kaina 0,90 EUR',
    languages: {
      upsert: [{ iso: 'lt' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Luxembourg
  {
    displayName: 'Luxembourg',
    name: 'LU',
    voteType: 'online',
    maxVotes: 20,
    price: 99,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'RTL Télé Lëtzebuerg (RTL)',
    privacyUrl: 'https://eurovision.rtl.lu/voting-privacy',
    votingText: 'Gitt op www.esc.vote fir ofzestëmmen',
    votingLegal:
      '1 Stëmm = 0,99€. Maximal 20 Stëmme pro Bezuelmethod.\nAll d’Konditiounen an d’Reglement fannt dir op www.esc.vote',
    languages: {
      upsert: [{ iso: 'lb' }, { iso: 'fr' }, { iso: 'de' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Latvia
  {
    displayName: 'Latvia',
    name: 'LV',
    voteType: 'online',
    maxVotes: 20,
    price: 67,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Latvijas Televīzija (LTV)',
    privacyUrl:
      'https://www.lsm.lv/raksts/kultura/izklaide/15.04.2024-pazinojums-par-konfidencialitati-2024-gada-eirovizijas-dziesmu-konkursa-tiessaistes-balsosana.a550489/',
    votingText: 'Lai balsotu, dodieties uz www.esc.vote',
    votingLegal: 'Maksa par tiešsaistes balsojumu 0,67 EUR (ar PVN)',
    languages: {
      upsert: [{ iso: 'lv' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Montenegro
  {
    displayName: 'Montenegro',
    name: 'ME',
    voteType: 'online',
    maxVotes: 20,
    price: 100,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Радио и Телевизија Црне Горе (RTCG)',
    privacyUrl: 'https://www.google.com',
    votingText: 'Go to www.esc.vote to vote',
    votingLegal: 'Svaki glas košta 1,00€ sa porezom',
    languages: {
      upsert: [{ iso: 'cnr' }, { iso: 'sr' }, { iso: 'hr' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Malta
  {
    displayName: 'Malta',
    name: 'MT',
    voteType: 'sms_suffix',
    maxVotes: 20,
    price: 70,
    currency: 'eur',
    destination: '506157',
    broadcaster: 'Public Broadcasting Services Limited (PBS)',
    privacyUrl:
      'https://tvmnews.mt/news/avviz-ta-privatezza-dwar-it-televoting/',
    votingText: 'Ibgħat SMS fuq 5061 57%@',
    votingLegal: 'Kull SMS jiswa €0.70 VAT inkluza. Ĝib permess mis-sid.',
    languages: { upsert: [{ iso: 'mt' }, { iso: 'en' }] },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Netherlands
  {
    displayName: 'Netherlands',
    name: 'NL',
    voteType: 'online',
    maxVotes: 20,
    price: 45,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'AVROTROS',
    privacyUrl:
      'https://www.avrotros.nl/article/privacyverklaring-online-stemmen-en-televoting-eurovisie-songfestival~517/',
    votingText: 'Stem online op ESC.vote',
    votingLegal:
      'Kosten per online stem 45 cent. Ben je jonger dan 18 jaar? Vraag toestemming aan je ouders of voogd. Info en voorwaarden op songfestival.nl',
    languages: {
      upsert: [{ iso: 'nl' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Norway
  {
    displayName: 'Norway',
    name: 'NO',
    voteType: 'online',
    maxVotes: 20,
    price: 500,
    currency: 'nok',
    destination: 'www.esc.vote',
    broadcaster: 'Norsk rikskringkasting (NRK)',
    privacyUrl:
      'https://www.nrk.no/mgp/personvernerklaering-for-telefonavstemning-under-eurovision-song-contest-2024-1.14505006',
    votingText: 'Gå til www.esc.vote for å stemme',
    votingLegal: 'kr 5,- pr stemme',
    languages: {
      upsert: [{ iso: 'no' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Poland
  {
    displayName: 'Poland',
    name: 'PL',
    voteType: 'online',
    maxVotes: 20,
    price: 492,
    currency: 'pln',
    destination: 'www.esc.vote',
    broadcaster: 'Telewizja Polska (TVP)',
    privacyUrl:
      'https://www.tvp.pl/53847760/polityka-prywatnosci-w-zakresie-televotingu-konkursu-piosenki-eurowizji',
    votingText: 'Aby zagłosować, przejdź na stronę www.esc.vote',
    votingLegal:
      'Koszt za głosowanie online z VAT: 4,92 zł - Organizator: EBU, Regulamin: www.eurowizja.tvp.pl',
    languages: {
      upsert: [{ iso: 'pl' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Portugal
  {
    displayName: 'Portugal',
    name: 'PT',
    voteType: 'call_suffix',
    maxVotes: 20,
    price: 74,
    currency: 'eur',
    destination: '7603008',
    broadcaster: 'Rádio e Televisão de Portugal (RTP)',
    privacyUrl:
      'https://media.rtp.pt/festivaldacancao/notas-protecao-dados-participacao-no-televoto-do-eurovision-song-contest/',
    votingText: 'Ligue 760 300 8%@',
    votingLegal: 'Custo de cada chamada: 0,60€ + IVA',
    languages: {
      upsert: [{ iso: 'pt' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Serbia
  {
    displayName: 'Serbia',
    name: 'RS',
    voteType: 'sms_text',
    maxVotes: 20,
    price: 3999,
    currency: 'rsd',
    destination: '1557',
    broadcaster: 'Радио-телевизија Србије (RTS)',
    privacyUrl:
      'https://www.rts.rs/rts/pesma-evrovizije/pesma-evrovizije-2024/vesti/5411206/zastitapodataka-ucesnika-teleglasanja-zapesmuevrovizije.html',
    votingText: 'Pošaljite SMS na 1557 sa tekstom: %@',
    votingLegal:
      'Cena po SMS-u: Telekom 38,64 din, Yettel 39,99 din, A1 i Globaltel 39,48 din uključujući PDV. NTH Media, korisnička služba 0113216815',
    languages: {
      upsert: [{ iso: 'sr' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi2Voters' },
    },
  },

  // Sweden
  {
    displayName: 'Sweden',
    name: 'SE',
    voteType: 'online',
    maxVotes: 20,
    price: 360,
    currency: 'sek',
    destination: 'www.esc.vote',
    broadcaster: 'Sveriges Television (SVT)',
    privacyUrl: 'https://www.svt.se/kontakt/cookies-och-personuppgifter',
    votingText: 'Gå till www.esc.vote för att rösta',
    votingLegal: '3,60kr per rösta',
    languages: {
      upsert: [{ iso: 'sv' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Slovenia
  {
    displayName: 'Slovenia',
    name: 'SI',
    voteType: 'online',
    maxVotes: 20,
    price: 84,
    currency: 'eur',
    destination: 'www.esc.vote',
    broadcaster: 'Radiotelevizija Slovenija (RTV)',
    privacyUrl:
      'https://www.rtvslo.si/zabava-in-slog/glasba/ema/pojasnila-o-varstvu-podatkov-pri-sodelovanju-v-telefonskem-glasovanju-na-tekmovanju-pesem-evrovizije/626839',
    votingText: 'Glasujete lahko tudi na spletni strani www.esc.vote',
    votingLegal:
      'Cena oddanega glasu je 0,84 € z ddv + morebitni stroški operaterja.',
    languages: {
      upsert: [{ iso: 'sl' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Ukraine
  {
    displayName: 'Ukraine',
    name: 'UA',
    voteType: 'online',
    maxVotes: 20,
    price: 850,
    currency: 'uah',
    destination: 'www.esc.vote',
    broadcaster: 'Суспільне (UA:PBC)',
    privacyUrl:
      'https://eurovision.ua/6109-povidomlennya-pro-zahyst-osobystoyi-informacziyi-u-zvyazku-z-telegolosuvannyam-na-pisennomu-konkursi-yevrobachennya-2024/',
    votingText: 'ЩОБ ПРОГОЛОСУВАТИ ПЕРЕЙДІТЬ НА САЙТ ESC.VOTE',
    votingLegal: '8,50 грн про онлайн голосування.',
    languages: {
      upsert: [{ iso: 'uk' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'semi1Voters' },
    },
  },

  // Rest of the World
  {
    displayName: 'Rest of the World',
    name: 'ROW',
    voteType: 'online',
    maxVotes: 20,
    price: 99,
    currency: 'eur',
    destination: 'www.esc.vote',
    votingText: 'Go to www.esc.vote to vote',
    broadcaster: 'European Broadcasting Union (EBU)',
    votingLegal:
      'Each vote costs 0.99€. Limit of 20 votes per Payment method. See website for Terms and Privacy.',
    languages: {
      upsert: [
        { iso: 'en' },
        { iso: 'fr' },
        { iso: 'es' },
        { iso: 'pt' },
        { iso: 'he' },
      ],
    },
    scenario: {
      upsert: { name: 'rowVoters' },
    },
  },

  // San Marino
  {
    displayName: 'San Marino',
    name: 'SM',
    languages: {
      upsert: [{ iso: 'it' }, { iso: 'en' }],
    },
    scenario: {
      upsert: { name: 'nonVoters' },
    },
  },
  {
    // Åland Islands
    name: 'AX',
    isTerritoryOf: { upsert: { name: 'FI' } },
  },
  {
    // Cocos (Keeling) Islands
    name: 'CC',
    isTerritoryOf: { upsert: { name: 'AU' } },
  },
  {
    // Christmas Island
    name: 'CX',
    isTerritoryOf: { upsert: { name: 'AU' } },
  },
  {
    // Faroe Islands
    name: 'FO',
    isTerritoryOf: { upsert: { name: 'DK' } },
  },
  {
    // French Guiana
    name: 'GF',
    isTerritoryOf: { upsert: { name: 'FR' } },
  },
  {
    // Guernsey
    name: 'GG',
    isTerritoryOf: { upsert: { name: 'GB' } },
  },
  {
    // Greenland
    name: 'GL',
    isTerritoryOf: { upsert: { name: 'DK' } },
  },
  {
    // Guadeloupe
    name: 'GP',
    isTerritoryOf: { upsert: { name: 'FR' } },
  },
  {
    // Heard Island and McDonald Islands
    name: 'HM',
    isTerritoryOf: { upsert: { name: 'AU' } },
  },
  {
    // Isle of Man
    name: 'IM',
    isTerritoryOf: { upsert: { name: 'GB' } },
  },
  {
    // Jersey
    name: 'JE',
    isTerritoryOf: { upsert: { name: 'GB' } },
  },
  {
    // Svalbard and Jan Mayen
    name: 'JS',
    isTerritoryOf: { upsert: { name: 'NO' } },
  },
  {
    // Martinique
    name: 'MQ',
    isTerritoryOf: { upsert: { name: 'FR' } },
  },
  {
    // Norfolk Island
    name: 'NF',
    isTerritoryOf: { upsert: { name: 'AU' } },
  },
  {
    // Réunion
    name: 'RE',
    isTerritoryOf: { upsert: { name: 'FR' } },
  },
  {
    // Mayotte
    name: 'YT',
    isTerritoryOf: { upsert: { name: 'FR' } },
  },
]
