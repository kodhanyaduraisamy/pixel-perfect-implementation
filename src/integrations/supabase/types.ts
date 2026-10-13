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
      attempts: {
        Row: {
          correct: boolean
          created_at: string
          id: string
          question_id: string
          quiz_id: string
          selected_index: number
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          id?: string
          question_id: string
          quiz_id: string
          selected_index: number
          user_id?: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          id?: string
          question_id?: string
          quiz_id?: string
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          content: string
          course_id: string
          created_at: string
          document_id: string
          id: string
          kind: string
          page: number | null
          seq: number
          slide: number | null
          topic_id: string | null
          ts_end: number | null
          ts_start: number | null
          tsv: unknown
          user_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          document_id: string
          id?: string
          kind?: string
          page?: number | null
          seq?: number
          slide?: number | null
          topic_id?: string | null
          ts_end?: number | null
          ts_start?: number | null
          tsv?: unknown
          user_id?: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          document_id?: string
          id?: string
          kind?: string
          page?: number | null
          seq?: number
          slide?: number | null
          topic_id?: string | null
          ts_end?: number | null
          ts_start?: number | null
          tsv?: unknown
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          course_id: string
          created_at: string
          error: string | null
          figure_count: number
          id: string
          is_demo: boolean
          kind: string
          mime: string | null
          name: string
          status: string
          storage_path: string | null
          summary: string | null
          unit_count: number
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          error?: string | null
          figure_count?: number
          id?: string
          is_demo?: boolean
          kind: string
          mime?: string | null
          name: string
          status?: string
          storage_path?: string | null
          summary?: string | null
          unit_count?: number
          user_id?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          error?: string | null
          figure_count?: number
          id?: string
          is_demo?: boolean
          kind?: string
          mime?: string | null
          name?: string
          status?: string
          storage_path?: string | null
          summary?: string | null
          unit_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_runs: {
        Row: {
          created_at: string
          id: string
          kind: string
          results: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          results: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          results?: Json
          user_id?: string
        }
        Relationships: []
      }
      mastery: {
        Row: {
          attempts: number
          correct: number
          p_mastery: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correct?: number
          p_mastery?: number
          topic_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          attempts?: number
          correct?: number
          p_mastery?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_events: {
        Row: {
          correct: boolean
          created_at: string
          difficulty: string
          id: string
          p_after: number
          p_before: number
          topic_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          difficulty: string
          id?: string
          p_after: number
          p_before: number
          topic_id: string
          user_id?: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          difficulty?: string
          id?: string
          p_after?: number
          p_before?: number
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          msg_id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          msg_id: string
          parts: Json
          role: string
          thread_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          msg_id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chunk_id: string | null
          correct_index: number
          course_id: string
          created_at: string
          difficulty: string
          evidence: string
          explanation: string
          id: string
          options: Json
          stem: string
          topic_id: string | null
          user_id: string
          verification_note: string | null
          verified: boolean
        }
        Insert: {
          chunk_id?: string | null
          correct_index: number
          course_id: string
          created_at?: string
          difficulty: string
          evidence: string
          explanation: string
          id?: string
          options: Json
          stem: string
          topic_id?: string | null
          user_id?: string
          verification_note?: string | null
          verified?: boolean
        }
        Update: {
          chunk_id?: string | null
          correct_index?: number
          course_id?: string
          created_at?: string
          difficulty?: string
          evidence?: string
          explanation?: string
          id?: string
          options?: Json
          stem?: string
          topic_id?: string | null
          user_id?: string
          verification_note?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "questions_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          difficulty: string
          generation_note: string | null
          id: string
          is_diagnostic: boolean
          question_ids: string[]
          score: number
          topic_id: string | null
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          difficulty: string
          generation_note?: string | null
          id?: string
          is_diagnostic?: boolean
          question_ids?: string[]
          score?: number
          topic_id?: string | null
          total?: number
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          difficulty?: string
          generation_note?: string | null
          id?: string
          is_diagnostic?: boolean
          question_ids?: string[]
          score?: number
          topic_id?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          prerequisites: string[]
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          prerequisites?: string[]
          user_id?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          prerequisites?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_chunks: {
        Args: { k?: number; p_course?: string; p_topic?: string; q: string }
        Returns: {
          content: string
          document_id: string
          document_name: string
          id: string
          kind: string
          page: number
          rank: number
          slide: number
          topic_id: string
          ts_end: number
          ts_start: number
        }[]
      }
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
