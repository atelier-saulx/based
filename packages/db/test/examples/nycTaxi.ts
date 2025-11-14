import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { join } from 'path'
import { readdir, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { gunzip as _gunzip } from 'zlib'
import { Sema } from 'async-sema'
import { logMemoryUsage } from '../shared/index.ts'

const gunzip = promisify(_gunzip)

// Data source https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page

// "LocationID", "Borough", "Zone", "service_zone"
// prettier-ignore
const taxiZoneLookup = [
  1, 'EWR', 'Newark Airport', 'EWR', //
  2, 'Queens', 'Jamaica Bay', 'Boro Zone', //
  3, 'Bronx', 'Allerton/Pelham Gardens', 'Boro Zone', //
  4, 'Manhattan', 'Alphabet City', 'Yellow Zone', //
  5, 'Staten Island', 'Arden Heights', 'Boro Zone', //
  6, 'Staten Island', 'Arrochar/Fort Wadsworth', 'Boro Zone', //
  7, 'Queens', 'Astoria', 'Boro Zone', //
  8, 'Queens', 'Astoria Park', 'Boro Zone', //
  9, 'Queens', 'Auburndale', 'Boro Zone', //
  10, 'Queens', 'Baisley Park', 'Boro Zone', //
  11, 'Brooklyn', 'Bath Beach', 'Boro Zone', //
  12, 'Manhattan', 'Battery Park', 'Yellow Zone', //
  13, 'Manhattan', 'Battery Park City', 'Yellow Zone', //
  14, 'Brooklyn', 'Bay Ridge', 'Boro Zone', //
  15, 'Queens', 'Bay Terrace/Fort Totten', 'Boro Zone', //
  16, 'Queens', 'Bayside', 'Boro Zone', //
  17, 'Brooklyn', 'Bedford', 'Boro Zone', //
  18, 'Bronx', 'Bedford Park', 'Boro Zone', //
  19, 'Queens', 'Bellerose', 'Boro Zone', //
  20, 'Bronx', 'Belmont', 'Boro Zone', //
  21, 'Brooklyn', 'Bensonhurst East', 'Boro Zone', //
  22, 'Brooklyn', 'Bensonhurst West', 'Boro Zone', //
  23, 'Staten Island', 'Bloomfield/Emerson Hill', 'Boro Zone', //
  24, 'Manhattan', 'Bloomingdale', 'Yellow Zone', //
  25, 'Brooklyn', 'Boerum Hill', 'Boro Zone', //
  26, 'Brooklyn', 'Borough Park', 'Boro Zone', //
  27, 'Queens', 'Breezy Point/Fort Tilden/Riis Beach', 'Boro Zone', //
  28, 'Queens', 'Briarwood/Jamaica Hills', 'Boro Zone', //
  29, 'Brooklyn', 'Brighton Beach', 'Boro Zone', //
  30, 'Queens', 'Broad Channel', 'Boro Zone', //
  31, 'Bronx', 'Bronx Park', 'Boro Zone', //
  32, 'Bronx', 'Bronxdale', 'Boro Zone', //
  33, 'Brooklyn', 'Brooklyn Heights', 'Boro Zone', //
  34, 'Brooklyn', 'Brooklyn Navy Yard', 'Boro Zone', //
  35, 'Brooklyn', 'Brownsville', 'Boro Zone', //
  36, 'Brooklyn', 'Bushwick North', 'Boro Zone', //
  37, 'Brooklyn', 'Bushwick South', 'Boro Zone', //
  38, 'Queens', 'Cambria Heights', 'Boro Zone', //
  39, 'Brooklyn', 'Canarsie', 'Boro Zone', //
  40, 'Brooklyn', 'Carroll Gardens', 'Boro Zone', //
  41, 'Manhattan', 'Central Harlem', 'Boro Zone', //
  42, 'Manhattan', 'Central Harlem North', 'Boro Zone', //
  43, 'Manhattan', 'Central Park', 'Yellow Zone', //
  44, 'Staten Island', 'Charleston/Tottenville', 'Boro Zone', //
  45, 'Manhattan', 'Chinatown', 'Yellow Zone', //
  46, 'Bronx', 'City Island', 'Boro Zone', //
  47, 'Bronx', 'Claremont/Bathgate', 'Boro Zone', //
  48, 'Manhattan', 'Clinton East', 'Yellow Zone', //
  49, 'Brooklyn', 'Clinton Hill', 'Boro Zone', //
  50, 'Manhattan', 'Clinton West', 'Yellow Zone', //
  51, 'Bronx', 'Co-Op City', 'Boro Zone', //
  52, 'Brooklyn', 'Cobble Hill', 'Boro Zone', //
  53, 'Queens', 'College Point', 'Boro Zone', //
  54, 'Brooklyn', 'Columbia Street', 'Boro Zone', //
  55, 'Brooklyn', 'Coney Island', 'Boro Zone', //
  56, 'Queens', 'Corona', 'Boro Zone', //
  57, 'Queens', 'Corona', 'Boro Zone', //
  58, 'Bronx', 'Country Club', 'Boro Zone', //
  59, 'Bronx', 'Crotona Park', 'Boro Zone', //
  60, 'Bronx', 'Crotona Park East', 'Boro Zone', //
  61, 'Brooklyn', 'Crown Heights North', 'Boro Zone', //
  62, 'Brooklyn', 'Crown Heights South', 'Boro Zone', //
  63, 'Brooklyn', 'Cypress Hills', 'Boro Zone', //
  64, 'Queens', 'Douglaston', 'Boro Zone', //
  65, 'Brooklyn', 'Downtown Brooklyn/MetroTech', 'Boro Zone', //
  66, 'Brooklyn', 'DUMBO/Vinegar Hill', 'Boro Zone', //
  67, 'Brooklyn', 'Dyker Heights', 'Boro Zone', //
  68, 'Manhattan', 'East Chelsea', 'Yellow Zone', //
  69, 'Bronx', 'East Concourse/Concourse Village', 'Boro Zone', //
  70, 'Queens', 'East Elmhurst', 'Boro Zone', //
  71, 'Brooklyn', 'East Flatbush/Farragut', 'Boro Zone', //
  72, 'Brooklyn', 'East Flatbush/Remsen Village', 'Boro Zone', //
  73, 'Queens', 'East Flushing', 'Boro Zone', //
  74, 'Manhattan', 'East Harlem North', 'Boro Zone', //
  75, 'Manhattan', 'East Harlem South', 'Boro Zone', //
  76, 'Brooklyn', 'East New York', 'Boro Zone', //
  77, 'Brooklyn', 'East New York/Pennsylvania Avenue', 'Boro Zone', //
  78, 'Bronx', 'East Tremont', 'Boro Zone', //
  79, 'Manhattan', 'East Village', 'Yellow Zone', //
  80, 'Brooklyn', 'East Williamsburg', 'Boro Zone', //
  81, 'Bronx', 'Eastchester', 'Boro Zone', //
  82, 'Queens', 'Elmhurst', 'Boro Zone', //
  83, 'Queens', 'Elmhurst/Maspeth', 'Boro Zone', //
  84, 'Staten Island', "Eltingville/Annadale/Prince's Bay", 'Boro Zone', //
  85, 'Brooklyn', 'Erasmus', 'Boro Zone', //
  86, 'Queens', 'Far Rockaway', 'Boro Zone', //
  87, 'Manhattan', 'Financial District North', 'Yellow Zone', //
  88, 'Manhattan', 'Financial District South', 'Yellow Zone', //
  89, 'Brooklyn', 'Flatbush/Ditmas Park', 'Boro Zone', //
  90, 'Manhattan', 'Flatiron', 'Yellow Zone', //
  91, 'Brooklyn', 'Flatlands', 'Boro Zone', //
  92, 'Queens', 'Flushing', 'Boro Zone', //
  93, 'Queens', 'Flushing Meadows-Corona Park', 'Boro Zone', //
  94, 'Bronx', 'Fordham South', 'Boro Zone', //
  95, 'Queens', 'Forest Hills', 'Boro Zone', //
  96, 'Queens', 'Forest Park/Highland Park', 'Boro Zone', //
  97, 'Brooklyn', 'Fort Greene', 'Boro Zone', //
  98, 'Queens', 'Fresh Meadows', 'Boro Zone', //
  99, 'Staten Island', 'Freshkills Park', 'Boro Zone', //
  100, 'Manhattan', 'Garment District', 'Yellow Zone', //
  101, 'Queens', 'Glen Oaks', 'Boro Zone', //
  102, 'Queens', 'Glendale', 'Boro Zone', //
  103, 'Manhattan', "Governor's Island/Ellis Island/Liberty Island", 'Yellow Zone', //
  104, 'Manhattan', "Governor's Island/Ellis Island/Liberty Island", 'Yellow Zone', //
  105, 'Manhattan', "Governor's Island/Ellis Island/Liberty Island", 'Yellow Zone', //
  106, 'Brooklyn', 'Gowanus', 'Boro Zone', //
  107, 'Manhattan', 'Gramercy', 'Yellow Zone', //
  108, 'Brooklyn', 'Gravesend', 'Boro Zone', //
  109, 'Staten Island', 'Great Kills', 'Boro Zone', //
  110, 'Staten Island', 'Great Kills Park', 'Boro Zone', //
  111, 'Brooklyn', 'Green-Wood Cemetery', 'Boro Zone', //
  112, 'Brooklyn', 'Greenpoint', 'Boro Zone', //
  113, 'Manhattan', 'Greenwich Village North', 'Yellow Zone', //
  114, 'Manhattan', 'Greenwich Village South', 'Yellow Zone', //
  115, 'Staten Island', 'Grymes Hill/Clifton', 'Boro Zone', //
  116, 'Manhattan', 'Hamilton Heights', 'Boro Zone', //
  117, 'Queens', 'Hammels/Arverne', 'Boro Zone', //
  118, 'Staten Island', 'Heartland Village/Todt Hill', 'Boro Zone', //
  119, 'Bronx', 'Highbridge', 'Boro Zone', //
  120, 'Manhattan', 'Highbridge Park', 'Boro Zone', //
  121, 'Queens', 'Hillcrest/Pomonok', 'Boro Zone', //
  122, 'Queens', 'Hollis', 'Boro Zone', //
  123, 'Brooklyn', 'Homecrest', 'Boro Zone', //
  124, 'Queens', 'Howard Beach', 'Boro Zone', //
  125, 'Manhattan', 'Hudson Sq', 'Yellow Zone', //
  126, 'Bronx', 'Hunts Point', 'Boro Zone', //
  127, 'Manhattan', 'Inwood', 'Boro Zone', //
  128, 'Manhattan', 'Inwood Hill Park', 'Boro Zone', //
  129, 'Queens', 'Jackson Heights', 'Boro Zone', //
  130, 'Queens', 'Jamaica', 'Boro Zone', //
  131, 'Queens', 'Jamaica Estates', 'Boro Zone', //
  132, 'Queens', 'JFK Airport', 'Airports', //
  133, 'Brooklyn', 'Kensington', 'Boro Zone', //
  134, 'Queens', 'Kew Gardens', 'Boro Zone', //
  135, 'Queens', 'Kew Gardens Hills', 'Boro Zone', //
  136, 'Bronx', 'Kingsbridge Heights', 'Boro Zone', //
  137, 'Manhattan', 'Kips Bay', 'Yellow Zone', //
  138, 'Queens', 'LaGuardia Airport', 'Airports', //
  139, 'Queens', 'Laurelton', 'Boro Zone', //
  140, 'Manhattan', 'Lenox Hill East', 'Yellow Zone', //
  141, 'Manhattan', 'Lenox Hill West', 'Yellow Zone', //
  142, 'Manhattan', 'Lincoln Square East', 'Yellow Zone', //
  143, 'Manhattan', 'Lincoln Square West', 'Yellow Zone', //
  144, 'Manhattan', 'Little Italy/NoLiTa', 'Yellow Zone', //
  145, 'Queens', 'Long Island City/Hunters Point', 'Boro Zone', //
  146, 'Queens', 'Long Island City/Queens Plaza', 'Boro Zone', //
  147, 'Bronx', 'Longwood', 'Boro Zone', //
  148, 'Manhattan', 'Lower East Side', 'Yellow Zone', //
  149, 'Brooklyn', 'Madison', 'Boro Zone', //
  150, 'Brooklyn', 'Manhattan Beach', 'Boro Zone', //
  151, 'Manhattan', 'Manhattan Valley', 'Yellow Zone', //
  152, 'Manhattan', 'Manhattanville', 'Boro Zone', //
  153, 'Manhattan', 'Marble Hill', 'Boro Zone', //
  154, 'Brooklyn', 'Marine Park/Floyd Bennett Field', 'Boro Zone', //
  155, 'Brooklyn', 'Marine Park/Mill Basin', 'Boro Zone', //
  156, 'Staten Island', 'Mariners Harbor', 'Boro Zone', //
  157, 'Queens', 'Maspeth', 'Boro Zone', //
  158, 'Manhattan', 'Meatpacking/West Village West', 'Yellow Zone', //
  159, 'Bronx', 'Melrose South', 'Boro Zone', //
  160, 'Queens', 'Middle Village', 'Boro Zone', //
  161, 'Manhattan', 'Midtown Center', 'Yellow Zone', //
  162, 'Manhattan', 'Midtown East', 'Yellow Zone', //
  163, 'Manhattan', 'Midtown North', 'Yellow Zone', //
  164, 'Manhattan', 'Midtown South', 'Yellow Zone', //
  165, 'Brooklyn', 'Midwood', 'Boro Zone', //
  166, 'Manhattan', 'Morningside Heights', 'Boro Zone', //
  167, 'Bronx', 'Morrisania/Melrose', 'Boro Zone', //
  168, 'Bronx', 'Mott Haven/Port Morris', 'Boro Zone', //
  169, 'Bronx', 'Mount Hope', 'Boro Zone', //
  170, 'Manhattan', 'Murray Hill', 'Yellow Zone', //
  171, 'Queens', 'Murray Hill-Queens', 'Boro Zone', //
  172, 'Staten Island', 'New Dorp/Midland Beach', 'Boro Zone', //
  173, 'Queens', 'North Corona', 'Boro Zone', //
  174, 'Bronx', 'Norwood', 'Boro Zone', //
  175, 'Queens', 'Oakland Gardens', 'Boro Zone', //
  176, 'Staten Island', 'Oakwood', 'Boro Zone', //
  177, 'Brooklyn', 'Ocean Hill', 'Boro Zone', //
  178, 'Brooklyn', 'Ocean Parkway South', 'Boro Zone', //
  179, 'Queens', 'Old Astoria', 'Boro Zone', //
  180, 'Queens', 'Ozone Park', 'Boro Zone', //
  181, 'Brooklyn', 'Park Slope', 'Boro Zone', //
  182, 'Bronx', 'Parkchester', 'Boro Zone', //
  183, 'Bronx', 'Pelham Bay', 'Boro Zone', //
  184, 'Bronx', 'Pelham Bay Park', 'Boro Zone', //
  185, 'Bronx', 'Pelham Parkway', 'Boro Zone', //
  186, 'Manhattan', 'Penn Station/Madison Sq West', 'Yellow Zone', //
  187, 'Staten Island', 'Port Richmond', 'Boro Zone', //
  188, 'Brooklyn', 'Prospect-Lefferts Gardens', 'Boro Zone', //
  189, 'Brooklyn', 'Prospect Heights', 'Boro Zone', //
  190, 'Brooklyn', 'Prospect Park', 'Boro Zone', //
  191, 'Queens', 'Queens Village', 'Boro Zone', //
  192, 'Queens', 'Queensboro Hill', 'Boro Zone', //
  193, 'Queens', 'Queensbridge/Ravenswood', 'Boro Zone', //
  194, 'Manhattan', 'Randalls Island', 'Yellow Zone', //
  195, 'Brooklyn', 'Red Hook', 'Boro Zone', //
  196, 'Queens', 'Rego Park', 'Boro Zone', //
  197, 'Queens', 'Richmond Hill', 'Boro Zone', //
  198, 'Queens', 'Ridgewood', 'Boro Zone', //
  199, 'Bronx', 'Rikers Island', 'Boro Zone', //
  200, 'Bronx', 'Riverdale/North Riverdale/Fieldston', 'Boro Zone', //
  201, 'Queens', 'Rockaway Park', 'Boro Zone', //
  202, 'Manhattan', 'Roosevelt Island', 'Boro Zone', //
  203, 'Queens', 'Rosedale', 'Boro Zone', //
  204, 'Staten Island', 'Rossville/Woodrow', 'Boro Zone', //
  205, 'Queens', 'Saint Albans', 'Boro Zone', //
  206, 'Staten Island', 'Saint George/New Brighton', 'Boro Zone', //
  207, 'Queens', 'Saint Michaels Cemetery/Woodside', 'Boro Zone', //
  208, 'Bronx', 'Schuylerville/Edgewater Park', 'Boro Zone', //
  209, 'Manhattan', 'Seaport', 'Yellow Zone', //
  210, 'Brooklyn', 'Sheepshead Bay', 'Boro Zone', //
  211, 'Manhattan', 'SoHo', 'Yellow Zone', //
  212, 'Bronx', 'Soundview/Bruckner', 'Boro Zone', //
  213, 'Bronx', 'Soundview/Castle Hill', 'Boro Zone', //
  214, 'Staten Island', 'South Beach/Dongan Hills', 'Boro Zone', //
  215, 'Queens', 'South Jamaica', 'Boro Zone', //
  216, 'Queens', 'South Ozone Park', 'Boro Zone', //
  217, 'Brooklyn', 'South Williamsburg', 'Boro Zone', //
  218, 'Queens', 'Springfield Gardens North', 'Boro Zone', //
  219, 'Queens', 'Springfield Gardens South', 'Boro Zone', //
  220, 'Bronx', 'Spuyten Duyvil/Kingsbridge', 'Boro Zone', //
  221, 'Staten Island', 'Stapleton', 'Boro Zone', //
  222, 'Brooklyn', 'Starrett City', 'Boro Zone', //
  223, 'Queens', 'Steinway', 'Boro Zone', //
  224, 'Manhattan', 'Stuy Town/Peter Cooper Village', 'Yellow Zone', //
  225, 'Brooklyn', 'Stuyvesant Heights', 'Boro Zone', //
  226, 'Queens', 'Sunnyside', 'Boro Zone', //
  227, 'Brooklyn', 'Sunset Park East', 'Boro Zone', //
  228, 'Brooklyn', 'Sunset Park West', 'Boro Zone', //
  229, 'Manhattan', 'Sutton Place/Turtle Bay North', 'Yellow Zone', //
  230, 'Manhattan', 'Times Sq/Theatre District', 'Yellow Zone', //
  231, 'Manhattan', 'TriBeCa/Civic Center', 'Yellow Zone', //
  232, 'Manhattan', 'Two Bridges/Seward Park', 'Yellow Zone', //
  233, 'Manhattan', 'UN/Turtle Bay South', 'Yellow Zone', //
  234, 'Manhattan', 'Union Sq', 'Yellow Zone', //
  235, 'Bronx', 'University Heights/Morris Heights', 'Boro Zone', //
  236, 'Manhattan', 'Upper East Side North', 'Yellow Zone', //
  237, 'Manhattan', 'Upper East Side South', 'Yellow Zone', //
  238, 'Manhattan', 'Upper West Side North', 'Yellow Zone', //
  239, 'Manhattan', 'Upper West Side South', 'Yellow Zone', //
  240, 'Bronx', 'Van Cortlandt Park', 'Boro Zone', //
  241, 'Bronx', 'Van Cortlandt Village', 'Boro Zone', //
  242, 'Bronx', 'Van Nest/Morris Park', 'Boro Zone', //
  243, 'Manhattan', 'Washington Heights North', 'Boro Zone', //
  244, 'Manhattan', 'Washington Heights South', 'Boro Zone', //
  245, 'Staten Island', 'West Brighton', 'Boro Zone', //
  246, 'Manhattan', 'West Chelsea/Hudson Yards', 'Yellow Zone', //
  247, 'Bronx', 'West Concourse', 'Boro Zone', //
  248, 'Bronx', 'West Farms/Bronx River', 'Boro Zone', //
  249, 'Manhattan', 'West Village', 'Yellow Zone', //
  250, 'Bronx', 'Westchester Village/Unionport', 'Boro Zone', //
  251, 'Staten Island', 'Westerleigh', 'Boro Zone', //
  252, 'Queens', 'Whitestone', 'Boro Zone', //
  253, 'Queens', 'Willets Point', 'Boro Zone', //
  254, 'Bronx', 'Williamsbridge/Olinville', 'Boro Zone', //
  255, 'Brooklyn', 'Williamsburg (North Side)', 'Boro Zone', //
  256, 'Brooklyn', 'Williamsburg (South Side)', 'Boro Zone', //
  257, 'Brooklyn', 'Windsor Terrace', 'Boro Zone', //
  258, 'Queens', 'Woodhaven', 'Boro Zone', //
  259, 'Bronx', 'Woodlawn/Wakefield', 'Boro Zone', //
  260, 'Queens', 'Woodside', 'Boro Zone', //
  261, 'Manhattan', 'World Trade Center', 'Yellow Zone', //
  262, 'Manhattan', 'Yorkville East', 'Yellow Zone', //
  263, 'Manhattan', 'Yorkville West', 'Yellow Zone', //
  264, 'Unknown', 'N/A', 'N/A', //
  265, 'N/A', 'Outside of NYC', 'N/A', //
]
// prettier-ignore
const rates = [
  1, ' Standard rate',
  2, 'JFK',
  3, 'Newark',
  4, 'Nassau/Westchester',
  5, 'Negotiated fare',
  6, 'Group ride',
  99, 'Null/unknown',
]
const pmt2enum = {
  '0': 'flex',
  '1': 'credit card',
  '2': 'cash',
  '3': 'no charge',
  '4': 'dispute',
  '5': 'unknown',
  '6': 'voided trip',
}
const day2enum = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
}

async function parseTripDump(filename: string) {
  const compressedData = await readFile(
    join(import.meta.dirname, 'nyc_taxi', filename).replace('/dist', ''),
  )
  const data = await gunzip(compressedData)
  return data
    .toString('utf-8')
    .split('\n')
    .filter((line) => line.length)
    .map((line) => JSON.parse(line))
}

class Loading {
  n: number
  i = 0

  constructor(n: number) {
    this.n = n
  }

  start() {
    process.stderr.write(`Loaded: 0/${this.n}`)
  }

  tick() {
    this.i++
    process.stdout.cursorTo(8)
    process.stdout.clearLine(1)
    process.stderr.write(`${this.i}/${this.n}`)
  }
}

await test.skip('taxi', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  // FIXME
  //t.after(() => t.backup(db))
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      zone: {
        props: {
          locationId: 'alias',
          borough: 'string',
          zone: 'string',
          serviceZone: { type: 'string', max: 16 },
        },
      },
      rate: {
        props: {
          rateCodeId: 'alias',
          name: { type: 'string', max: 20 },
        },
      },
      vendor: {
        props: {
          vendorId: 'alias',
          name: 'string',
        },
      },
      trip: {
        hooks: {
          create(payload: Record<string, any>) {
            payload.pickupYear = new Date(
              `${payload.pickup.getUTCFullYear()}`,
            ).getUTCFullYear()
            payload.pickupHour = payload.pickup.getUTCHours()
            payload.avgSpeed =
              payload.tripDistance /
              ((payload.dropoff.getTime() - payload.pickup.getTime()) / 3.6e6 ||
                0)
          },
        },
        props: {
          vendor: { ref: 'vendor', prop: 'trips' },
          pickupYear: 'int16',
          pickupHour: 'uint8',
          pickup: 'timestamp',
          dropoff: 'timestamp',
          pickupLoc: { ref: 'zone', prop: 'pickups' },
          dropoffLoc: { ref: 'zone', prop: 'dropoffs' },
          pickupDropoffLocs: 'string', // TODO Would be better if we could combine fields in groupBy()
          avgSpeed: 'number',
          passengerCount: 'uint8',
          tripDistance: 'number',
          storeAndFwd: 'boolean',
          rate: { ref: 'rate', prop: 'trips' },
          paymentType: {
            type: 'enum',
            enum: [
              'flex',
              'credit card',
              'cash',
              'no charge',
              'dispute',
              'unknown',
              'voided trip',
            ],
            default: 'unknown',
          },
          fees: {
            type: 'object',
            props: {
              fareAmount: 'int32', // $ cents
              extra: 'int32', // $ cents
              mtaTax: 'int32', // $ cents
              tipAmount: 'int32', // $ cents
              tollsAmount: 'int32', // $ cents
              imporvementSurcharge: 'int32', // $ cents
              totalAmount: 'int32', // $ cents
              congestionSurcharge: 'int32', // $ cents
              airportFee: 'int32', // $ cents
              cbdCongestionFee: 'int32', // $ cents
            },
          },
        },
      },
    },
  })

  for (let i = 0; i < taxiZoneLookup.length; i += 4) {
    db.create('zone', {
      locationId: `${taxiZoneLookup[i]}`,
      borough: taxiZoneLookup[i + 1],
      zone: taxiZoneLookup[i + 2],
      serviceZone: taxiZoneLookup[i + 3],
    })
  }

  for (let i = 0; i < rates.length; i += 2) {
    db.create('rate', {
      rateCodeId: `${rates[i]}`,
      name: rates[i + 1],
    })
  }
  //await db.query('rate').include('*').get().inspect()

  db.create('vendor', {
    vendorId: '1',
    name: 'Creative Mobile Technologies, LLC',
  })
  db.create('vendor', {
    vendorId: '2',
    name: 'Curb Mobility, LLC',
  })
  db.create('vendor', {
    vendorId: '6',
    name: 'Myle Technologies Inc',
  })
  db.create('vendor', {
    vendorId: '7',
    name: 'Helix',
  })

  await db.drain()

  const clamp = (val: number, min: number, max: number) =>
    Math.min(Math.max(val, min), max)
  const sanitize = (x: any) =>
    clamp(Math.round(isNaN(x) ? 0 : x), -2147483648, 2147483647)

  const createTrip = async (trip: any) => {
    // TODO toObject() shouldn't be needed
    const { id: vendor = null } = await db
      .query('vendor', { vendorId: trip.VendorID })
      .include('id')
      .get()
      .toObject()
    const { id: rate = null } = await db
      .query('rate', { rateCodeId: trip.RatecodeID ?? '99' })
      .include('id')
      .get()
      .toObject()
    const { id: pickupLoc = null } = await db
      .query('zone', { locationId: trip.PULocationID ?? '264' })
      .include('id')
      .get()
      .toObject()
    const { id: dropoffLoc = null } = await db
      .query('zone', { locationId: trip.DOLocationID ?? '264' })
      .include('id')
      .get()
      .toObject()

    const pickup = new Date(trip.tpep_pickup_datetime)
    const dropoff = new Date(trip.tpep_dropoff_datetime)
    db.create('trip', {
      vendor,
      pickup,
      dropoff,
      passengerCount: sanitize(Number(trip.passenger_count)),
      tripDistance: trip.trip_distance,
      rate,
      storeAndFwd: trip.store_and_fwd_flag === 'Y',
      pickupLoc,
      dropoffLoc,
      pickupDropoffLocs: `${trip.PULocationID ?? '264'}-${trip.DOLocationID ?? '264'}`,
      paymentType: pmt2enum[trip.payment_type] ?? 'unknown',
      fees: {
        fareAmount: sanitize(100 * trip.fare_amount),
        extra: sanitize(100 * trip.extra),
        mtaTax: sanitize(100 * trip.mta_tax),
        tipAmount: sanitize(100 * trip.tip_amount),
        tollsAmount: sanitize(100 * trip.tolls_amount),
        imporvementSurcharge: sanitize(100 * trip.improvement_surcharge),
        totalAmount: sanitize(100 * trip.total_amount),
        congestionSurcharge: sanitize(100 * trip.congestion_surcharge),
        airportFee: sanitize(100 * trip.Airport_fee),
        cbdCongestionFee: sanitize(100 * trip.cbd_congestion_fee),
      },
    })
  }

  const N = 2
  const loading = new Loading(N)
  const s = new Sema(4)
  const makeTrip = async (filename: string) => {
    const trips = await parseTripDump(filename)
    await Promise.all(trips.map((trip) => createTrip(trip)))
    loading.tick()
  }

  loading.start()
  const taxiDumps = (
    await readdir(join(import.meta.dirname, 'nyc_taxi').replace('/dist', ''))
  ).slice(0, N)
  await Promise.all(
    taxiDumps.map(async (trip) => {
      await s.acquire()
      makeTrip(trip).then(() => s.release())
    }),
  )
  await s.drain()
  process.stderr.write('\n')
  await db.drain()

  await db.query('zone').include('borough').get().inspect()
  // await db.query('zone').include('*').get().inspect()
  // await db.query('vendor').include('trips').get().inspect()
  // await db
  //   .query('trip')
  //   .include('pickupLoc', 'dropoffLoc', 'paymentType')
  //   .get()
  //   .inspect()
  await db
    .query('trip')
    .include(
      'pickup',
      'tripDistance',
      'pickupLoc.borough',
      'dropoffLoc.borough',
    )
    .get()
    .inspect()
  // await db.query('trip').count().groupBy('dropoffLoc.borough').get().inspect() // TBD: nested prop in groupBy
  await db.query('trip').count().groupBy('dropoffLoc').get().inspect()
  await db.query('trip').count().groupBy('paymentType').get().inspect()
  console.log('trip count')
  await db.query('trip').count().get().inspect()
  // await db.query('vendor').sum('trips').get().inspect() BUG: requires validation or // TBD: group by all

  // const makeDays = (startYear: number, endYear: number) => {
  //   const days: Date[] = []
  //   const d = new Date(`${startYear}`)
  //   while (d.getFullYear() <= endYear) {
  //     d.setDate(d.getDate() + 1)
  //     days.push(new Date(d))
  //   }
  //   return days
  // }
  // const days = makeDays(2022, 2024)
  // const res = await Promise.all(
  //   days.map((day) =>
  //     db
  //       .query('trip')
  //       .filter('pickup', '>=', day)
  //       .filter('dropoff', '<=', new Date(day).setUTCHours(23, 59, 59, 0))
  //       //.count()
  //       .sum('fees.totalAmount', 'fees.tollsAmount', 'fees.tipAmount')
  //       .groupBy('pickup', { step: 3600 * 24 })
  //       .get(),
  //   ),
  // )
  //   res.map((r) => r.toObject())

  // Yearly/Monthly/Daily revenue
  console.log('Yearly/Monthly/Daily revenue')
  await db
    .query('trip')
    //.filter('pickupYear', '>=', new Date('2022-01-01'))
    //.filter('pickupYear', '<=', new Date('2024-05-31'))
    .filter('pickupYear', '>=', 2022)
    .filter('pickupYear', '<=', 2024)
    .sum('fees.totalAmount', 'fees.tollsAmount', 'fees.tipAmount')
    .groupBy('pickup', { step: 'month', timeZone: 'America/New_York' })
    .get()
    .inspect()

  // Revenue Breakdown by Vendor
  console.log('Revenue Breakdown by Vendor')
  await db
    .query('vendor')
    .include('name', (select) => {
      select('trips')
        .groupBy('pickup', { step: 'year', timeZone: 'America/New_York' })
        .sum('fees.totalAmount', 'fees.tollsAmount', 'fees.tipAmount')
    })
    .get()
    .inspect()

  // Top tippers
  // Find the top 10 trips per day with the highest tip per mile. // TBD: need callback to combine functions tipAmount/tripDistance
  console.log('Top tippers')
  await db
    .query('trip')
    // .include('pickup', 'fees.tipAmount', 'tripDistance')
    .groupBy('pickup', { step: 'day', timeZone: 'America/New_York' })
    .max('fees.tipAmount')
    .avg('tripDistance')
    .sort('fees.tipAmount', 'desc') // TBD: sort has no effect yet
    .range(0, 10) // TBD: range has no effect yet
    .get()
    .inspect()

  // Rush hour utilization
  console.log('Rush hour utilization')
  const rh1 = await db
    .query('trip')
    .filter('pickupHour', '>=', 7)
    .filter('pickupHour', '<=', 10)
    .or((t) => t.filter('pickupHour', '>=', 16).filter('pickupHour', '<=', 19))
    .groupBy('pickup', { step: 'dow', timeZone: 'America/New_York' })
    .count()
    .get()
    .toObject()
  const rh2 = await db
    .query('trip')
    .groupBy('pickup', { step: 'dow', timeZone: 'America/New_York' })
    .count()
    .get()
    .toObject()
  console.log(
    Object.keys(day2enum).reduce(
      (prev, key) => (
        (prev[day2enum[key]] = rh1[key].count / rh2[key].count),
        prev
      ),
      {},
    ),
  )

  // Most popular routes
  await db
    .query('trip')
    .groupBy('pickupDropoffLocs')
    .count()
    .sort('pickupDropoffLocs') // TBD: has no effect yethas no effect yet
    .range(0, 10) // TBD: has no effect yet
    .get()
    .inspect()

  // Avg rush hour speed between zones
  console.log('Avg rush hour speed between zones')
  await db
    .query('trip')
    .filter('pickupHour', '>=', 7)
    .filter('pickupHour', '<=', 10)
    .or((t) => t.filter('pickupHour', '>=', 16).filter('pickupHour', '<=', 19))
    .groupBy('pickup', { step: 'dow', timeZone: 'America/New_York' })
    //.groupBy('pickupDropoffLocs')
    .harmonicMean('avgSpeed')
    .get()
    .inspect()

  logMemoryUsage()
})
