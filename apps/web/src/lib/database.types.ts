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
      chats: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          last_message_at: string
          level: Database["public"]["Enums"]["learning_level"]
          notebook_id: string
          summary: string | null
          summary_turns: number
          title: string | null
          title_generated: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          level?: Database["public"]["Enums"]["learning_level"]
          notebook_id: string
          summary?: string | null
          summary_turns?: number
          title?: string | null
          title_generated?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          level?: Database["public"]["Enums"]["learning_level"]
          notebook_id?: string
          summary?: string | null
          summary_turns?: number
          title?: string | null
          title_generated?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          bboxes: Json | null
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          figure_id: string | null
          fts: unknown
          headings: string[] | null
          id: string
          ingest_run_id: string
          kind: string
          notebook_id: string
          page_end: number | null
          page_start: number | null
          section: string | null
          token_count: number | null
        }
        Insert: {
          bboxes?: Json | null
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          figure_id?: string | null
          fts?: unknown
          headings?: string[] | null
          id?: string
          ingest_run_id: string
          kind?: string
          notebook_id: string
          page_end?: number | null
          page_start?: number | null
          section?: string | null
          token_count?: number | null
        }
        Update: {
          bboxes?: Json | null
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          figure_id?: string | null
          fts?: unknown
          headings?: string[] | null
          id?: string
          ingest_run_id?: string
          kind?: string
          notebook_id?: string
          page_end?: number | null
          page_start?: number | null
          section?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_figure_id_fkey"
            columns: ["figure_id"]
            isOneToOne: false
            referencedRelation: "figures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          attempt: number
          chunk_count: number
          created_at: string
          deleted_at: string | null
          embedding_model: string | null
          error_code: string | null
          error_vars: Json | null
          figure_count: number
          file_size: number | null
          finished_at: string | null
          id: string
          included: boolean
          ingest_run_id: string
          markdown: string | null
          mime_type: string | null
          notebook_id: string
          ocr_used: boolean
          original_filename: string
          page_count: number | null
          parser_version: string | null
          progress: number
          ready_run_id: string | null
          reprocessed_at: string[]
          sha256: string | null
          stage: Database["public"]["Enums"]["document_stage"]
          stage_detail: string | null
          stage_timings: Json
          started_at: string | null
          storage_path: string
          title: string
          token_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number
          chunk_count?: number
          created_at?: string
          deleted_at?: string | null
          embedding_model?: string | null
          error_code?: string | null
          error_vars?: Json | null
          figure_count?: number
          file_size?: number | null
          finished_at?: string | null
          id?: string
          included?: boolean
          ingest_run_id?: string
          markdown?: string | null
          mime_type?: string | null
          notebook_id: string
          ocr_used?: boolean
          original_filename: string
          page_count?: number | null
          parser_version?: string | null
          progress?: number
          ready_run_id?: string | null
          reprocessed_at?: string[]
          sha256?: string | null
          stage?: Database["public"]["Enums"]["document_stage"]
          stage_detail?: string | null
          stage_timings?: Json
          started_at?: string | null
          storage_path: string
          title: string
          token_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number
          chunk_count?: number
          created_at?: string
          deleted_at?: string | null
          embedding_model?: string | null
          error_code?: string | null
          error_vars?: Json | null
          figure_count?: number
          file_size?: number | null
          finished_at?: string | null
          id?: string
          included?: boolean
          ingest_run_id?: string
          markdown?: string | null
          mime_type?: string | null
          notebook_id?: string
          ocr_used?: boolean
          original_filename?: string
          page_count?: number | null
          parser_version?: string | null
          progress?: number
          ready_run_id?: string | null
          reprocessed_at?: string[]
          sha256?: string | null
          stage?: Database["public"]["Enums"]["document_stage"]
          stage_detail?: string | null
          stage_timings?: Json
          started_at?: string | null
          storage_path?: string
          title?: string
          token_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          message_id: string
          rating: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id: string
          rating: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string
          rating?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      figures: {
        Row: {
          bbox: Json | null
          created_at: string
          description: string | null
          document_id: string
          height: number | null
          id: string
          image_path: string
          image_sha256: string | null
          ingest_run_id: string
          label: string | null
          ordinal: number
          page: number | null
          paper_caption: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          bbox?: Json | null
          created_at?: string
          description?: string | null
          document_id: string
          height?: number | null
          id?: string
          image_path: string
          image_sha256?: string | null
          ingest_run_id: string
          label?: string | null
          ordinal: number
          page?: number | null
          paper_caption?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          bbox?: Json | null
          created_at?: string
          description?: string | null
          document_id?: string
          height?: number | null
          id?: string
          image_path?: string
          image_sha256?: string | null
          ingest_run_id?: string
          label?: string | null
          ordinal?: number
          page?: number | null
          paper_caption?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "figures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: Json
          created_at: string
          document_id: string | null
          id: string
          level: string
          notebook_id: string
          topic: string
        }
        Insert: {
          content: Json
          created_at?: string
          document_id?: string | null
          id?: string
          level?: string
          notebook_id: string
          topic: string
        }
        Update: {
          content?: Json
          created_at?: string
          document_id?: string | null
          id?: string
          level?: string
          notebook_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          citations: Json | null
          command: string | null
          content: string
          created_at: string
          error_code: string | null
          flags: Json
          followups: string[]
          id: string
          latency_ms: number | null
          level: Database["public"]["Enums"]["learning_level"] | null
          mode: string | null
          model: string | null
          parent_id: string | null
          parts: Json
          prompt_version: string | null
          role: string
          selected_document_ids: string[]
          status: string
          usage: Json | null
          user_id: string
          version: number
        }
        Insert: {
          chat_id: string
          citations?: Json | null
          command?: string | null
          content?: string
          created_at?: string
          error_code?: string | null
          flags?: Json
          followups?: string[]
          id?: string
          latency_ms?: number | null
          level?: Database["public"]["Enums"]["learning_level"] | null
          mode?: string | null
          model?: string | null
          parent_id?: string | null
          parts?: Json
          prompt_version?: string | null
          role: string
          selected_document_ids?: string[]
          status?: string
          usage?: Json | null
          user_id: string
          version?: number
        }
        Update: {
          chat_id?: string
          citations?: Json | null
          command?: string | null
          content?: string
          created_at?: string
          error_code?: string | null
          flags?: Json
          followups?: string[]
          id?: string
          latency_ms?: number | null
          level?: Database["public"]["Enums"]["learning_level"] | null
          mode?: string | null
          model?: string | null
          parent_id?: string | null
          parts?: Json
          prompt_version?: string | null
          role?: string
          selected_document_ids?: string[]
          status?: string
          usage?: Json | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          description: string | null
          exam_date: string | null
          id: string
          last_opened_at: string | null
          position: string
          status: Database["public"]["Enums"]["notebook_status"]
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          exam_date?: string | null
          id?: string
          last_opened_at?: string | null
          position?: string
          status?: Database["public"]["Enums"]["notebook_status"]
          subject?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          exam_date?: string | null
          id?: string
          last_opened_at?: string | null
          position?: string
          status?: Database["public"]["Enums"]["notebook_status"]
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string | null
          chat_id: string | null
          created_at: string
          deleted_at: string | null
          document_id: string | null
          id: string
          message_id: string | null
          notebook_id: string
          page: number | null
          quote: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          chat_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document_id?: string | null
          id?: string
          message_id?: string | null
          notebook_id: string
          page?: number | null
          quote?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          chat_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document_id?: string | null
          id?: string
          message_id?: string | null
          notebook_id?: string
          page?: number | null
          quote?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_source: string | null
          full_name: string | null
          id: string
          last_sign_in_method: string | null
          level: Database["public"]["Enums"]["learning_level"]
          onboarding_done: boolean
          onboarding_step: number
          role: Database["public"]["Enums"]["user_role"] | null
          subjects: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_source?: string | null
          full_name?: string | null
          id: string
          last_sign_in_method?: string | null
          level?: Database["public"]["Enums"]["learning_level"]
          onboarding_done?: boolean
          onboarding_step?: number
          role?: Database["public"]["Enums"]["user_role"] | null
          subjects?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_source?: string | null
          full_name?: string | null
          id?: string
          last_sign_in_method?: string | null
          level?: Database["public"]["Enums"]["learning_level"]
          onboarding_done?: boolean
          onboarding_step?: number
          role?: Database["public"]["Enums"]["user_role"] | null
          subjects?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_ingest: {
        Args: {
          p_document_id: string
          p_markdown?: string
          p_run_id: string
          p_token_count?: number
        }
        Returns: boolean
      }
      hybrid_search: {
        Args: {
          full_text_weight?: number
          match_count?: number
          p_document_ids?: string[]
          p_notebook_id: string
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          bboxes: Json
          chunk_index: number
          content: string
          document_id: string
          figure_id: string
          headings: string[]
          id: string
          kind: string
          notebook_id: string
          page_end: number
          page_start: number
          score: number
          section: string
        }[]
      }
      ingest_timings: {
        Args: {
          p_from: Database["public"]["Enums"]["document_stage"]
          p_now: string
          p_timings: Json
          p_to: Database["public"]["Enums"]["document_stage"]
        }
        Returns: Json
      }
      ingest_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["document_stage"]
          p_to: Database["public"]["Enums"]["document_stage"]
        }
        Returns: boolean
      }
      realtime_tables: { Args: never; Returns: string[] }
      rls_status: {
        Args: never
        Returns: {
          rls_enabled: boolean
          table_name: string
        }[]
      }
      set_document_stage: {
        Args: {
          p_detail?: string
          p_document_id: string
          p_error_code?: string
          p_error_vars?: Json
          p_progress?: number
          p_run_id: string
          p_stage: Database["public"]["Enums"]["document_stage"]
        }
        Returns: boolean
      }
      start_ingest_run: { Args: { p_document_id: string }; Returns: string }
    }
    Enums: {
      document_stage:
        | "uploading"
        | "queued"
        | "validating"
        | "repairing"
        | "needs_password"
        | "parsing_fast"
        | "fast_ready"
        | "parsing_deep"
        | "ocr"
        | "reading_figures"
        | "indexing"
        | "ready"
        | "failed"
      learning_level: "beginner" | "intermediate" | "expert"
      notebook_status: "to_read" | "learning" | "reviewing" | "mastered"
      user_role: "student" | "instructor" | "developer" | "researcher"
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
    Enums: {
      document_stage: [
        "uploading",
        "queued",
        "validating",
        "repairing",
        "needs_password",
        "parsing_fast",
        "fast_ready",
        "parsing_deep",
        "ocr",
        "reading_figures",
        "indexing",
        "ready",
        "failed",
      ],
      learning_level: ["beginner", "intermediate", "expert"],
      notebook_status: ["to_read", "learning", "reviewing", "mastered"],
      user_role: ["student", "instructor", "developer", "researcher"],
    },
  },
} as const
