export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type MatchStatus = 'upcoming' | 'live' | 'completed'
export type PlayerRole = 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper'
export type IPLTeam = 'CSK' | 'MI' | 'RCB' | 'KKR' | 'DC' | 'SRH' | 'PBKS' | 'RR' | 'LSG' | 'GT'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          role: 'user' | 'admin'
          invite_accepted: boolean
          total_score: number
          prediction_score: number
          fantasy_score: number
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          invite_accepted?: boolean
          total_score?: number
          prediction_score?: number
          fantasy_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          invite_accepted?: boolean
          total_score?: number
          prediction_score?: number
          fantasy_score?: number
          created_at?: string
        }
      }
      invites: {
        Row: {
          id: string
          token: string
          invited_email: string
          invited_by: string | null
          used_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          token?: string
          invited_email: string
          invited_by?: string | null
          used_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          token?: string
          invited_email?: string
          invited_by?: string | null
          used_at?: string | null
          expires_at?: string
          created_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          team_a: IPLTeam
          team_b: IPLTeam
          venue: string | null
          match_date: string
          status: MatchStatus
          prediction_deadline: string
          fantasy_deadline: string
          toss_winner: IPLTeam | null
          toss_decision: 'bat' | 'bowl' | null
          match_winner: IPLTeam | null
          created_at: string
        }
        Insert: {
          id?: string
          team_a: IPLTeam
          team_b: IPLTeam
          venue?: string | null
          match_date: string
          status?: MatchStatus
          prediction_deadline: string
          fantasy_deadline: string
          toss_winner?: IPLTeam | null
          toss_decision?: 'bat' | 'bowl' | null
          match_winner?: IPLTeam | null
          created_at?: string
        }
        Update: {
          id?: string
          team_a?: IPLTeam
          team_b?: IPLTeam
          venue?: string | null
          match_date?: string
          status?: MatchStatus
          prediction_deadline?: string
          fantasy_deadline?: string
          toss_winner?: IPLTeam | null
          toss_decision?: 'bat' | 'bowl' | null
          match_winner?: IPLTeam | null
          created_at?: string
        }
      }
      ipl_players: {
        Row: {
          id: string
          name: string
          team: IPLTeam
          role: PlayerRole
          image_url: string | null
          is_active: boolean
          created_at: string
          country: string | null
          career_runs: number | null
          career_wickets: number | null
          strike_rate: number | null
          economy_rate: number | null
        }
        Insert: {
          id?: string
          name: string
          team: IPLTeam
          role: PlayerRole
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          country?: string | null
          career_runs?: number | null
          career_wickets?: number | null
          strike_rate?: number | null
          economy_rate?: number | null
        }
        Update: {
          id?: string
          name?: string
          team?: IPLTeam
          role?: PlayerRole
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          country?: string | null
          career_runs?: number | null
          career_wickets?: number | null
          strike_rate?: number | null
          economy_rate?: number | null
        }
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: string
          predicted_toss_winner: IPLTeam
          predicted_match_winner: IPLTeam
          points_earned: number
          is_scored: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          match_id: string
          predicted_toss_winner: IPLTeam
          predicted_match_winner: IPLTeam
          points_earned?: number
          is_scored?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          match_id?: string
          predicted_toss_winner?: IPLTeam
          predicted_match_winner?: IPLTeam
          points_earned?: number
          is_scored?: boolean
          created_at?: string
        }
      }
      fantasy_teams: {
        Row: {
          id: string
          user_id: string
          phase: 'league' | 'knockout'
          batsman_1_id: string
          batsman_2_id: string
          bowler_1_id: string
          bowler_2_id: string
          flex_player_id: string
          total_points: number
          is_scored: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phase?: 'league' | 'knockout'
          batsman_1_id: string
          batsman_2_id: string
          bowler_1_id: string
          bowler_2_id: string
          flex_player_id: string
          total_points?: number
          is_scored?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          phase?: 'league' | 'knockout'
          batsman_1_id?: string
          batsman_2_id?: string
          bowler_1_id?: string
          bowler_2_id?: string
          flex_player_id?: string
          total_points?: number
          is_scored?: boolean
          created_at?: string
        }
      }
      fantasy_lock: {
        Row: {
          id: string
          is_locked: boolean
          phase: 'league' | 'knockout'
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_locked?: boolean
          phase?: 'league' | 'knockout'
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_locked?: boolean
          phase?: 'league' | 'knockout'
          updated_at?: string
          updated_by?: string | null
        }
      }
      player_match_stats: {
        Row: {
          id: string
          player_id: string
          match_id: string
          runs_scored: number
          balls_faced: number
          fours: number
          sixes: number
          wickets: number
          economy_rate: number | null
          catches: number
          stumpings: number
          run_outs: number
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          match_id: string
          runs_scored?: number
          balls_faced?: number
          fours?: number
          sixes?: number
          wickets?: number
          economy_rate?: number | null
          catches?: number
          stumpings?: number
          run_outs?: number
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          match_id?: string
          runs_scored?: number
          balls_faced?: number
          fours?: number
          sixes?: number
          wickets?: number
          economy_rate?: number | null
          catches?: number
          stumpings?: number
          run_outs?: number
          created_at?: string
        }
      }
      fantasy_scores: {
        Row: {
          id: string
          fantasy_team_id: string
          player_id: string
          match_id: string
          points_breakdown: Json
          total_points: number
          created_at: string
        }
        Insert: {
          id?: string
          fantasy_team_id: string
          player_id: string
          match_id: string
          points_breakdown?: Json
          total_points?: number
          created_at?: string
        }
        Update: {
          id?: string
          fantasy_team_id?: string
          player_id?: string
          match_id?: string
          points_breakdown?: Json
          total_points?: number
          created_at?: string
        }
      }
    }
    Functions: {
      accept_invite: {
        Args: { invite_token: string; user_email: string }
        Returns: boolean
      }
    }
  }
}
