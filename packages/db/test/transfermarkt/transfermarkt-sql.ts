// Filename: create_database.js

import Database from 'better-sqlite3'
import { mkdir } from 'fs/promises'

await mkdir('tmp').catch(() => {})
// Create a new database or open an existing one
const db = new Database('tmp/transfermarkt.db')

// Enable foreign key constraints
db.pragma('foreign_keys = ON')

// Wrap table creation in a transaction
const createTables = db
  .transaction(() => {
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
      FOREIGN KEY (player_current_club_id) REFERENCES club(club_id),
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
  })
  .immediate()

console.log('Database and tables have been created successfully.')
