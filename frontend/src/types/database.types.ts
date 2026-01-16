export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            teams: {
                Row: {
                    id: number
                    team_type: Database["public"]["Enums"]["team_type"]
                    // Add other fields as needed for strict typing, but for now we focus on Enums
                }
                Insert: {
                    id?: number
                    team_type?: Database["public"]["Enums"]["team_type"]
                }
                Update: {
                    id?: number
                    team_type?: Database["public"]["Enums"]["team_type"]
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            team_type: "local" | "invited"
            match_status: "scheduled" | "in_progress" | "completed" | "cancelled"
            // Note: schema.sql has 'semifinal', 'third_place' which are not in validation.ts yet.
            // Adding them here to represent the DB truth.
            match_stage: "preliminary" | "semifinal" | "third_place" | "final" | "training"
            match_result: "home_win" | "away_win" | "draw"
            approval_status: "pending" | "approved" | "rejected"
            user_role: "admin" | "venue_staff" | "viewer"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
