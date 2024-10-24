import { Schema } from '@based/schema'

// ORDER IS IMPORTANT (FOR SQL)
export const types = [
  'competition',
  'club',
  'player',
  'game',
  'transfer',
  'game_event',
  'appearance',
  'game_lineup',
  'player_valuation',
]

export const schema: Schema = {
  // --- club
  types: {
    club: {
      props: {
        club_id: 'uint32', // '105'
        club_code: 'string', // 'sv-darmstadt-98'
        name: 'string', // 'SV Darmstadt 98'
        domestic_competition_id: 'string', // 'L1'
        total_market_value: 'number', // ''
        squad_size: 'uint8', // '27'
        average_age: 'number', // '25.6'
        foreigners_number: 'uint8', // '13'
        foreigners_percentage: 'number', // '48.1'
        national_team_players: 'uint8', // '1'
        stadium_name: 'string', // 'Merck-Stadion am Böllenfalltor'
        stadium_seats: 'uint16', // '17810'
        net_transfer_record: 'string', // '+€3.05m'
        coach_name: 'string', // ''
        last_season: 'uint16', // '2023'
        filename: 'string', // '../data/raw/transfermarkt-scraper/2023/clubs.json.gz'
        url: 'string', // 'https://www.transfermarkt.co.uk/sv-darmstadt-98/startseite/verein/105'

        // --- refs
        outgoing_transfers: {
          items: {
            ref: 'transfer',
            prop: 'from_club',
          },
        },
        incoming_transfers: {
          items: {
            ref: 'transfer',
            prop: 'to_club',
          },
        },
        domestic_competition: {
          ref: 'competition',
          prop: 'clubs',
        },
        // home_club_games: {
        //   items: {
        //     ref: 'club_game',
        //     prop: 'club',
        //   },
        // },
        // away_club_games: {
        //   items: {
        //     ref: 'club_game',
        //     prop: 'opponent',
        //   },
        // },
        home_games: {
          items: {
            ref: 'game',
            prop: 'home_club',
          },
        },
        away_games: {
          items: {
            ref: 'game',
            prop: 'away_club',
          },
        },
        players: {
          items: {
            ref: 'player',
            prop: 'current_club',
          },
        },
        valuations: {
          items: {
            ref: 'player_valuation',
            prop: 'current_club',
          },
        },
        game_events: {
          items: {
            ref: 'game_event',
            prop: 'club',
          },
        },
        appearances: {
          items: {
            ref: 'appearance',
            prop: 'player_club',
          },
        },
        game_lineups: {
          items: {
            ref: 'game_lineup',
            prop: 'club',
          },
        },
      },
    },
    // --- competition
    competition: {
      props: {
        competition_id: 'string', // 'CIT'
        competition_code: 'string', // 'italy-cup'
        name: 'string', // 'italy-cup'
        sub_type: 'string', // 'domestic_cup'
        type: 'string', // 'domestic_cup'
        country_id: 'uint32', // '75'
        country_name: 'string', // 'Italy'
        domestic_league_code: 'string', // 'IT1'
        confederation: 'string', // 'europa'
        url: 'string', // 'https://www.transfermarkt.co.uk/italy-cup/startseite/wettbewerb/CIT'
        is_major_national_league: 'boolean', // 'false'

        // --- refs
        clubs: {
          items: {
            ref: 'club',
            prop: 'domestic_competition',
          },
        },
        valuations: {
          items: {
            ref: 'player_valuation',
            prop: 'player_club_domestic_competition',
          },
        },
        games: {
          items: {
            ref: 'game',
            prop: 'competition',
          },
        },
        appearances: {
          items: {
            ref: 'appearance',
            prop: 'competition',
          },
        },
      },
    },
    // --- transfer
    transfer: {
      props: {
        player_id: 'uint32', // '195778'
        transfer_date: 'timestamp', // '2026-06-30'
        transfer_season: 'string', // '25/26'
        from_club_id: 'uint32', // '79'
        to_club_id: 'uint32', // '27'
        from_club_name: 'string', // 'VfB Stuttgart'
        to_club_name: 'string', // 'Bayern Munich'
        transfer_fee: 'number', // '0.000'
        market_value_in_eur: 'number', // '12000000.000'
        player_name: 'string', // 'Alexander Nübel'

        // --- refs
        player: {
          ref: 'player',
          prop: 'transfers',
        },
        from_club: {
          ref: 'club',
          prop: 'outgoing_transfers',
        },
        to_club: {
          ref: 'club',
          prop: 'incoming_transfers',
        },
      },
    },
    // --- club_game
    // club_game: {
    //   props: {
    //     game_id: 'uint32', // '2320450'
    //     club_id: 'uint32', // '1468'
    //     own_goals: 'uint8', // '0'
    //     own_position: 'string', // ''
    //     own_manager_name: 'string', // 'Holger Bachthaler'
    //     opponent_id: 'uint32', // '24'
    //     opponent_goals: 'uint8', // '2'
    //     opponent_position: 'string', // ''
    //     opponent_manager_name: 'string', // 'Armin Veh'
    //     hosting: 'string', // 'Home'
    //     is_win: 'boolean', // '0' (interpreted as false)
    //     // --- refs
    //     club: {
    //       ref: 'club',
    //       prop: 'home_club_games',
    //     },
    //     opponent: {
    //       ref: 'club',
    //       prop: 'away_club_games',
    //     },
    //   },
    // },
    // --- player
    player: {
      props: {
        player_id: 'uint32', // '10'
        first_name: 'string', // 'Miroslav'
        last_name: 'string', // 'Klose'
        name: 'string', // 'Miroslav Klose'
        last_season: 'uint16', // '2015'
        current_club_id: 'uint32', // '398'
        player_code: 'string', // 'miroslav-klose'
        country_of_birth: 'string', // 'Poland'
        city_of_birth: 'string', // 'Opole'
        country_of_citizenship: 'string', // 'Germany'
        date_of_birth: 'timestamp', // '1978-06-09 00:00:00'
        sub_position: 'string', // 'Centre-Forward'
        position: 'string', // 'Attack'
        foot: 'string', // 'right'
        height_in_cm: 'uint8', // '184'
        contract_expiration_date: 'timestamp', // ''
        agent_name: 'string', // 'ASBW Sport Marketing'
        image_url: 'string', // 'https://img.a.transfermarkt.technology/portrait/header/10-1448468291.jpg?lm=1'
        url: 'string', // 'https://www.transfermarkt.co.uk/miroslav-klose/profil/spieler/10'
        current_club_domestic_competition_id: 'string', // 'IT1'
        current_club_name: 'string', // 'Società Sportiva Lazio S.p.A.'
        market_value_in_eur: 'number', // '1000000'
        highest_market_value_in_eur: 'number', // '30000000'

        // --- refs
        transfers: {
          items: {
            ref: 'transfer',
            prop: 'player',
          },
        },
        current_club: {
          ref: 'club',
          prop: 'players',
        },
        // dont need current_club_domestic_competition
        valuations: {
          items: {
            ref: 'player_valuation',
            prop: 'player',
          },
        },
        game_events: {
          items: {
            ref: 'game_event',
            prop: 'player',
          },
        },
        game_events_in: {
          items: {
            ref: 'game_event',
            prop: 'player_in',
          },
        },
        game_events_assist: {
          items: {
            ref: 'game_event',
            prop: 'player_assist',
          },
        },
        appearances: {
          items: {
            ref: 'appearance',
            prop: 'player',
          },
        },
        game_lineups: {
          items: {
            ref: 'game_lineup',
            prop: 'player',
          },
        },
      },
    },
    // --- player_valuation
    player_valuation: {
      props: {
        player_id: 'uint32', // '405973'
        date: 'timestamp', // '2000-01-20'
        market_value_in_eur: 'number', // '150000'
        current_club_id: 'uint32', // '3057'
        player_club_domestic_competition_id: 'string', // 'BE1'

        // --- refs
        player: {
          ref: 'player',
          prop: 'valuations',
        },
        current_club: {
          ref: 'club',
          prop: 'valuations',
        },
        player_club_domestic_competition: {
          ref: 'competition',
          prop: 'valuations',
        },
      },
    },
    // --- game
    game: {
      props: {
        game_id: 'uint32', // '2321044'
        competition_id: 'string', // 'L1'
        season: 'uint16', // '2013'
        round: 'string', // '2. Matchday'
        date: 'timestamp', // '2013-08-18'
        home_club_id: 'uint32', // '16'
        away_club_id: 'uint32', // '23'
        home_club_goals: 'uint8', // '2'
        away_club_goals: 'uint8', // '1'
        home_club_position: 'uint8', // '1'
        away_club_position: 'uint8', // '15'
        home_club_manager_name: 'string', // 'Jürgen Klopp'
        away_club_manager_name: 'string', // 'Torsten Lieberknecht'
        stadium: 'string', // 'SIGNAL IDUNA PARK'
        attendance: 'uint32', // '80200'
        referee: 'string', // 'Peter Sippel'
        url: 'string', // 'https://www.transfermarkt.co.uk/...'
        home_club_formation: 'string', // '4-2-3-1'
        away_club_formation: 'string', // '4-3-2-1'
        home_club_name: 'string', // 'Borussia Dortmund'
        away_club_name: 'string', // 'Eintracht Braunschweig'
        aggregate: 'string', // '2:1'
        competition_type: 'string', // 'domestic_league'

        // --- refs
        competition: {
          ref: 'competition',
          prop: 'games',
        },
        home_club: {
          ref: 'club',
          prop: 'home_games',
        },
        away_club: {
          ref: 'club',
          prop: 'away_games',
        },
        game_events: {
          items: {
            ref: 'game_event',
            prop: 'game',
          },
        },
        game_lineups: {
          items: {
            ref: 'game_lineup',
            prop: 'game',
          },
        },
        appearances: {
          items: {
            ref: 'appearance',
            prop: 'game',
          },
        },
      },
    },
    // --- game_event
    game_event: {
      props: {
        game_event_id: 'string', // '2f41da30c471492e7d4a984951671677'
        date: 'timestamp', // '2012-08-05'
        game_id: 'uint32', // '2211607'
        minute: 'uint8', // '77'
        type: 'string', // 'Cards'
        club_id: 'uint32', // '610'
        player_id: 'uint32', // '4425'
        description: 'string', // '1. Yellow card Mass confrontation'
        player_in_id: 'uint32', // '' (nullable)
        player_assist_id: 'uint32', // '' (nullable)

        // --- refs
        game: {
          ref: 'game',
          prop: 'game_events',
        },
        club: {
          ref: 'club',
          prop: 'game_events',
        },
        player: {
          ref: 'player',
          prop: 'game_events',
        },
        player_in: {
          ref: 'player',
          prop: 'game_events_in',
        },
        player_assist: {
          ref: 'player',
          prop: 'game_events_assist',
        },
      },
    },
    // --- appearance
    appearance: {
      props: {
        appearance_id: 'string', // '2231978_38004'
        game_id: 'uint32', // '2231978'
        player_id: 'uint32', // '38004'
        player_club_id: 'uint32', // '853'
        player_current_club_id: 'uint32', // '235'
        date: 'timestamp', // '2012-07-03'
        player_name: 'string', // 'Aurélien Joachim'
        competition_id: 'string', // 'CLQ'
        yellow_cards: 'uint8', // '0'
        red_cards: 'uint8', // '0'
        goals: 'uint8', // '2'
        assists: 'uint8', // '0'
        minutes_played: 'uint16', // '90'

        // --- refs
        game: {
          ref: 'game',
          prop: 'appearances',
        },
        player: {
          ref: 'player',
          prop: 'appearances',
        },
        player_club: {
          ref: 'club',
          prop: 'appearances',
        },
        competition: {
          ref: 'competition',
          prop: 'appearances',
        },
        // dont need player_current_club
      },
    },
    // --- game_lineup
    game_lineup: {
      props: {
        game_lineups_id: 'string', // 'b2dbe01c3656b06c8e23e9de714e26bb'
        date: 'timestamp', // '2013-07-27'
        game_id: 'uint32', // '2317258'
        player_id: 'uint32', // '1443'
        club_id: 'uint32', // '610'
        player_name: 'string', // 'Christian Poulsen'
        type: 'string', // 'substitutes'
        position: 'string', // 'Defensive Midfield'
        number: 'uint8', // '5'
        team_captain: 'boolean', // '0' (interpreted as false)

        // --- refs
        game: {
          ref: 'game',
          prop: 'game_lineups',
        },
        player: {
          ref: 'player',
          prop: 'game_lineups',
        },
        club: {
          ref: 'club',
          prop: 'game_lineups',
        },
      },
    },
  },
}
