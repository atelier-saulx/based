import Database from 'better-sqlite3'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpDir } from './shared/utils.js'
import { parseData } from './shared/parseData.js'
import { perf } from '../utils.js'

const map = await parseData()
const path = join(tmpDir, 'transfermarkt.db')

await mkdir(tmpDir).catch(() => {})
await rm(path).catch(() => {})
const db = new Database(path)
db.pragma('foreign_keys = ON')

const schemaPerf = perf('insert schema - sqlite3')
db.transaction(() => {
  // --- Table: club
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS club (
      club_id INTEGER PRIMARY KEY,
      club_code TEXT,
      name TEXT,
      domestic_competition_id TEXT,
      total_market_value REAL,
      squad_size INTEGER,
      average_age REAL,
      foreigners_number INTEGER,
      foreigners_percentage REAL,
      national_team_players INTEGER,
      stadium_name TEXT,
      stadium_seats INTEGER,
      net_transfer_record TEXT,
      coach_name TEXT,
      last_season INTEGER,
      filename TEXT,
      url TEXT,
      FOREIGN KEY (domestic_competition_id) REFERENCES competition(competition_id)
    );
  `,
  ).run()

  // --- Table: competition
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS competition (
      competition_id TEXT PRIMARY KEY,
      competition_code TEXT,
      name TEXT,
      sub_type TEXT,
      type TEXT,
      country_id INTEGER,
      country_name TEXT,
      domestic_league_code TEXT,
      confederation TEXT,
      url TEXT,
      is_major_national_league INTEGER
    );
  `,
  ).run()

  // --- Table: player
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS player (
      player_id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      name TEXT,
      last_season INTEGER,
      current_club_id INTEGER,
      player_code TEXT,
      country_of_birth TEXT,
      city_of_birth TEXT,
      country_of_citizenship TEXT,
      date_of_birth INTEGER,
      sub_position TEXT,
      position TEXT,
      foot TEXT,
      height_in_cm INTEGER,
      contract_expiration_date INTEGER,
      agent_name TEXT,
      image_url TEXT,
      url TEXT,
      current_club_domestic_competition_id TEXT,
      current_club_name TEXT,
      market_value_in_eur REAL,
      highest_market_value_in_eur REAL,
      FOREIGN KEY (current_club_id) REFERENCES club(club_id)
    );
  `,
  ).run()

  // --- Table: transfer
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS transfer (
      player_id INTEGER,
      transfer_date INTEGER,
      transfer_season TEXT,
      from_club_id INTEGER,
      to_club_id INTEGER,
      from_club_name TEXT,
      to_club_name TEXT,
      transfer_fee REAL,
      market_value_in_eur REAL,
      player_name TEXT,
      PRIMARY KEY (player_id, transfer_date),
      FOREIGN KEY (player_id) REFERENCES player(player_id),
      FOREIGN KEY (from_club_id) REFERENCES club(club_id),
      FOREIGN KEY (to_club_id) REFERENCES club(club_id)
    );
  `,
  ).run()

  // --- Table: club_game
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS club_game (
      game_id INTEGER,
      club_id INTEGER,
      own_goals INTEGER,
      own_position TEXT,
      own_manager_name TEXT,
      opponent_id INTEGER,
      opponent_goals INTEGER,
      opponent_position TEXT,
      opponent_manager_name TEXT,
      hosting TEXT,
      is_win INTEGER,
      PRIMARY KEY (game_id, club_id),
      FOREIGN KEY (game_id) REFERENCES game(game_id),
      FOREIGN KEY (club_id) REFERENCES club(club_id),
      FOREIGN KEY (opponent_id) REFERENCES club(club_id)
    );
  `,
  ).run()

  // --- Table: player_valuation
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS player_valuation (
      player_id INTEGER,
      date INTEGER,
      market_value_in_eur REAL,
      current_club_id INTEGER,
      player_club_domestic_competition_id TEXT,
      PRIMARY KEY (player_id, date),
      FOREIGN KEY (player_id) REFERENCES player(player_id),
      FOREIGN KEY (current_club_id) REFERENCES club(club_id)
    );
  `,
  ).run()

  // --- Table: game
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS game (
      game_id INTEGER PRIMARY KEY,
      competition_id TEXT,
      season INTEGER,
      round TEXT,
      date INTEGER,
      home_club_id INTEGER,
      away_club_id INTEGER,
      home_club_goals INTEGER,
      away_club_goals INTEGER,
      home_club_position INTEGER,
      away_club_position INTEGER,
      home_club_manager_name TEXT,
      away_club_manager_name TEXT,
      stadium TEXT,
      attendance INTEGER,
      referee TEXT,
      url TEXT,
      home_club_formation TEXT,
      away_club_formation TEXT,
      home_club_name TEXT,
      away_club_name TEXT,
      aggregate TEXT,
      competition_type TEXT,
      FOREIGN KEY (competition_id) REFERENCES competition(competition_id),
      FOREIGN KEY (home_club_id) REFERENCES club(club_id),
      FOREIGN KEY (away_club_id) REFERENCES club(club_id)
    );
  `,
  ).run()

  // --- Table: game_event
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS game_event (
      game_event_id TEXT PRIMARY KEY,
      date INTEGER,
      game_id INTEGER,
      minute INTEGER,
      type TEXT,
      club_id INTEGER,
      player_id INTEGER,
      description TEXT,
      player_in_id INTEGER,
      player_assist_id INTEGER,
      FOREIGN KEY (game_id) REFERENCES game(game_id),
      FOREIGN KEY (club_id) REFERENCES club(club_id),
      FOREIGN KEY (player_id) REFERENCES player(player_id)
    );
  `,
  ).run()

  // --- Table: appearance
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS appearance (
      appearance_id TEXT PRIMARY KEY,
      game_id INTEGER,
      player_id INTEGER,
      player_club_id INTEGER,
      player_current_club_id INTEGER,
      date INTEGER,
      player_name TEXT,
      competition_id TEXT,
      yellow_cards INTEGER,
      red_cards INTEGER,
      goals INTEGER,
      assists INTEGER,
      minutes_played INTEGER,
      FOREIGN KEY (game_id) REFERENCES game(game_id),
      FOREIGN KEY (player_id) REFERENCES player(player_id),
      FOREIGN KEY (player_club_id) REFERENCES club(club_id),
      FOREIGN KEY (competition_id) REFERENCES competition(competition_id)
    );
  `,
  ).run()

  // --- Table: game_lineup
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS game_lineup (
      game_lineups_id TEXT PRIMARY KEY,
      date INTEGER,
      game_id INTEGER,
      player_id INTEGER,
      club_id INTEGER,
      player_name TEXT,
      type TEXT,
      position TEXT,
      number INTEGER,
      team_captain INTEGER,
      FOREIGN KEY (game_id) REFERENCES game(game_id),
      FOREIGN KEY (player_id) REFERENCES player(player_id),
      FOREIGN KEY (club_id) REFERENCES club(club_id)
    );
  `,
  ).run()
}).immediate()

schemaPerf()
console.log('Database and tables have been created successfully.')

const queries = {
  competition: [
    'competition_id',
    'competition_code',
    'name',
    'sub_type',
    'type',
    'country_id',
    'country_name',
    'domestic_league_code',
    'confederation',
    'url',
    'is_major_national_league',
  ],
  club: [
    'club_id',
    'club_code',
    'name',
    'domestic_competition_id',
    'total_market_value',
    'squad_size',
    'average_age',
    'foreigners_number',
    'foreigners_percentage',
    'national_team_players',
    'stadium_name',
    'stadium_seats',
    'net_transfer_record',
    'coach_name',
    'last_season',
    'filename',
    'url',
  ],
  player: [
    'player_id',
    'first_name',
    'last_name',
    'name',
    'last_season',
    'current_club_id',
    'player_code',
    'country_of_birth',
    'city_of_birth',
    'country_of_citizenship',
    'date_of_birth',
    'sub_position',
    'position',
    'foot',
    'height_in_cm',
    'contract_expiration_date',
    'agent_name',
    'image_url',
    'url',
    'current_club_domestic_competition_id',
    'current_club_name',
    'market_value_in_eur',
    'highest_market_value_in_eur',
  ],
  game: [
    'game_id',
    'competition_id',
    'season',
    'round',
    'date',
    'home_club_id',
    'away_club_id',
    'home_club_goals',
    'away_club_goals',
    'home_club_position',
    'away_club_position',
    'home_club_manager_name',
    'away_club_manager_name',
    'stadium',
    'attendance',
    'referee',
    'url',
    'home_club_formation',
    'away_club_formation',
    'home_club_name',
    'away_club_name',
    'aggregate',
    'competition_type',
  ],
  transfer: [
    'player_id',
    'transfer_date',
    'transfer_season',
    'from_club_id',
    'to_club_id',
    'from_club_name',
    'to_club_name',
    'transfer_fee',
    'market_value_in_eur',
    'player_name',
  ],
  game_event: [
    'game_event_id',
    'date',
    'game_id',
    'minute',
    'type',
    'club_id',
    'player_id',
    'description',
    'player_in_id',
    'player_assist_id',
  ],
  appearance: [
    'appearance_id',
    'game_id',
    'player_id',
    'player_club_id',
    'player_current_club_id',
    'date',
    'player_name',
    'competition_id',
    'yellow_cards',
    'red_cards',
    'goals',
    'assists',
    'minutes_played',
  ],
  game_lineup: [
    'game_lineups_id',
    'date',
    'game_id',
    'player_id',
    'club_id',
    'player_name',
    'type',
    'position',
    'number',
    'team_captain',
  ],
  player_valuation: [
    'player_id',
    'date',
    'market_value_in_eur',
    'current_club_id',
    'player_club_domestic_competition_id',
  ],
}

const inserts = []

for (const type in queries) {
  const keys = queries[type]
  const query = db.prepare(`INSERT OR IGNORE INTO ${type} (
      ${keys.join(', ')}
    ) VALUES (
      ${keys.map((key) => '@' + key).join(', ')}
    );`)

  const insert = db.transaction((data) => {
    for (const item of data) {
      query.run(item.data)
    }
  })

  for (const item of map[type].data) {
    for (const key of keys) {
      if (key in item.data) {
        const val = item.data[key]
        if (typeof val === 'boolean') {
          item.data[key] = val ? 1 : 0
        } else {
          item.data[key] = val
        }
      } else {
        item.data[key] = null
      }
    }
  }

  inserts.push(() => insert(map[type].data))
}

const insertPerf = perf('insert node - sql')
for (const fn of inserts) {
  fn()
}
insertPerf()

// Close the database connection
db.close()
