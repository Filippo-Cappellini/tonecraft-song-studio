export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      amps: {
        Row: {
          brand: string
          description: string
          id: string
          instrument_id: string
          kind: string
          name: string
          sort: number
          watts: number
        }
        Insert: {
          brand: string
          description: string
          id: string
          instrument_id: string
          kind: string
          name: string
          sort?: number
          watts: number
        }
        Update: {
          brand?: string
          description?: string
          id?: string
          instrument_id?: string
          kind?: string
          name?: string
          sort?: number
          watts?: number
        }
        Relationships: [
          {
            foreignKeyName: "amps_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          country: string
          description: string
          founded: number | null
          id: string
          instrument_id: string
          name: string
          sort: number
        }
        Insert: {
          country: string
          description: string
          founded?: number | null
          id: string
          instrument_id: string
          name: string
          sort?: number
        }
        Update: {
          country?: string
          description?: string
          founded?: number | null
          id?: string
          instrument_id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "brands_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          description: string
          free: boolean
          id: string
          instrument_id: string
          language: string
          level: number
          sort: number
          teacher: string
          title: string
          url: string
        }
        Insert: {
          description: string
          free?: boolean
          id: string
          instrument_id: string
          language?: string
          level?: number
          sort?: number
          teacher: string
          title: string
          url: string
        }
        Update: {
          description?: string
          free?: boolean
          id?: string
          instrument_id?: string
          language?: string
          level?: number
          sort?: number
          teacher?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          bpm: number
          category: string
          description: string
          id: string
          instrument_id: string
          level: number
          minutes: number
          notation: string | null
          steps: string
          title: string
        }
        Insert: {
          bpm: number
          category: string
          description: string
          id: string
          instrument_id: string
          level: number
          minutes: number
          notation?: string | null
          steps: string
          title: string
        }
        Update: {
          bpm?: number
          category?: string
          description?: string
          id?: string
          instrument_id?: string
          level?: number
          minutes?: number
          notation?: string | null
          steps?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          has_amp: boolean
          id: string
          name: string
          sort: number
          tagline: string
        }
        Insert: {
          has_amp?: boolean
          id: string
          name: string
          sort?: number
          tagline: string
        }
        Update: {
          has_amp?: boolean
          id?: string
          name?: string
          sort?: number
          tagline?: string
        }
        Relationships: []
      }
      learning_paths: {
        Row: {
          description: string
          id: string
          instrument_id: string
          level: number
          sort: number
          subtitle: string
          title: string
        }
        Insert: {
          description: string
          id: string
          instrument_id: string
          level?: number
          sort?: number
          subtitle: string
          title: string
        }
        Update: {
          description?: string
          id?: string
          instrument_id?: string
          level?: number
          sort?: number
          subtitle?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          bpm: number | null
          checklist: string
          exercise_id: string | null
          explanation: string
          goal: string
          id: string
          minutes: number
          notation: string | null
          path_id: string
          practice: string
          song_id: string | null
          sort: number
          title: string
          tool: string | null
          tool_kind: string | null
          tool_note: number | null
        }
        Insert: {
          bpm?: number | null
          checklist: string
          exercise_id?: string | null
          explanation: string
          goal: string
          id: string
          minutes?: number
          notation?: string | null
          path_id: string
          practice: string
          song_id?: string | null
          sort: number
          title: string
          tool?: string | null
          tool_kind?: string | null
          tool_note?: number | null
        }
        Update: {
          bpm?: number | null
          checklist?: string
          exercise_id?: string | null
          explanation?: string
          goal?: string
          id?: string
          minutes?: number
          notation?: string | null
          path_id?: string
          practice?: string
          song_id?: string | null
          sort?: number
          title?: string
          tool?: string | null
          tool_kind?: string | null
          tool_note?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      legends: {
        Row: {
          fact: string
          id: string
          person: string
          role: string
          sort: number
          title: string
          year: number | null
        }
        Insert: {
          fact: string
          id: string
          person: string
          role: string
          sort?: number
          title: string
          year?: number | null
        }
        Update: {
          fact?: string
          id?: string
          person?: string
          role?: string
          sort?: number
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      models: {
        Row: {
          brand_id: string
          color: string
          description: string
          finish: string
          hardware: string
          id: string
          name: string
          pickguard: string | null
          pickups: string
          price_eur: number
          shape: string
          sort: number
        }
        Insert: {
          brand_id: string
          color: string
          description: string
          finish?: string
          hardware?: string
          id: string
          name: string
          pickguard?: string | null
          pickups: string
          price_eur: number
          shape: string
          sort?: number
        }
        Update: {
          brand_id?: string
          color?: string
          description?: string
          finish?: string
          hardware?: string
          id?: string
          name?: string
          pickguard?: string | null
          pickups?: string
          price_eur?: number
          shape?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          accuracy: number
          created_at: string
          id: string
          player: string
          score: number
          song_id: string
        }
        Insert: {
          accuracy: number
          created_at?: string
          id?: string
          player?: string
          score: number
          song_id: string
        }
        Update: {
          accuracy?: number
          created_at?: string
          id?: string
          player?: string
          score?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album: string
          artist: string
          bpm: number
          difficulty: number
          genre: string
          id: string
          instrument_id: string
          notation: string | null
          song_key: string
          title: string
          tuning: string
          year: number
        }
        Insert: {
          album: string
          artist: string
          bpm: number
          difficulty: number
          genre: string
          id: string
          instrument_id: string
          notation?: string | null
          song_key: string
          title: string
          tuning?: string
          year: number
        }
        Update: {
          album?: string
          artist?: string
          bpm?: number
          difficulty?: number
          genre?: string
          id?: string
          instrument_id?: string
          notation?: string | null
          song_key?: string
          title?: string
          tuning?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "songs_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      tones: {
        Row: {
          amp: string
          bass: number
          effects: string
          gain: number
          mid: number
          notes: string
          pickup: string
          presence: number
          reverb: number
          song_id: string
          treble: number
        }
        Insert: {
          amp: string
          bass: number
          effects: string
          gain: number
          mid: number
          notes: string
          pickup: string
          presence: number
          reverb: number
          song_id: string
          treble: number
        }
        Update: {
          amp?: string
          bass?: number
          effects?: string
          gain?: number
          mid?: number
          notes?: string
          pickup?: string
          presence?: number
          reverb?: number
          song_id?: string
          treble?: number
        }
        Relationships: [
          {
            foreignKeyName: "tones_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
