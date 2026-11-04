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
      chat_messages: {
        Row: {
          citations: Json
          content: string
          created_at: string
          id: string
          is_demo: boolean
          language: string | null
          refused: boolean
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          citations?: Json
          content: string
          created_at?: string
          id?: string
          is_demo?: boolean
          language?: string | null
          refused?: boolean
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          citations?: Json
          content?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          language?: string | null
          refused?: boolean
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          language: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      complaint_drafts: {
        Row: {
          created_at: string
          document_type: string
          draft_content: string
          form_data: Json
          id: string
          language: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          draft_content: string
          form_data?: Json
          id?: string
          language?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          draft_content?: string
          form_data?: Json
          id?: string
          language?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          availability: string | null
          category: string
          created_at: string
          display_order: number
          id: string
          is_demo: boolean
          name: string
          phone_number: string
          purpose: string
          source_reference: string
          updated_at: string
        }
        Insert: {
          availability?: string | null
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_demo?: boolean
          name: string
          phone_number: string
          purpose: string
          source_reference?: string
          updated_at?: string
        }
        Update: {
          availability?: string | null
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_demo?: boolean
          name?: string
          phone_number?: string
          purpose?: string
          source_reference?: string
          updated_at?: string
        }
        Relationships: []
      }
      government_schemes: {
        Row: {
          application_process: string | null
          beneficiaries: string | null
          benefits: string | null
          category: string
          created_at: string
          department: string
          description: string
          eligibility: Json
          id: string
          is_demo: boolean
          last_verified_date: string | null
          level: string
          name: string
          official_url: string | null
          required_documents: string | null
          source_reference: string
          state_name: string | null
          updated_at: string
        }
        Insert: {
          application_process?: string | null
          beneficiaries?: string | null
          benefits?: string | null
          category?: string
          created_at?: string
          department: string
          description: string
          eligibility?: Json
          id?: string
          is_demo?: boolean
          last_verified_date?: string | null
          level?: string
          name: string
          official_url?: string | null
          required_documents?: string | null
          source_reference?: string
          state_name?: string | null
          updated_at?: string
        }
        Update: {
          application_process?: string | null
          beneficiaries?: string | null
          benefits?: string | null
          category?: string
          created_at?: string
          department?: string
          description?: string
          eligibility?: Json
          id?: string
          is_demo?: boolean
          last_verified_date?: string | null
          level?: string
          name?: string
          official_url?: string | null
          required_documents?: string | null
          source_reference?: string
          state_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ingestion_jobs: {
        Row: {
          chunks_created: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          embeddings_created: number
          error: string | null
          id: string
          pages_processed: number
          status: string
        }
        Insert: {
          chunks_created?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          embeddings_created?: number
          error?: string | null
          id?: string
          pages_processed?: number
          status?: string
        }
        Update: {
          chunks_created?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          embeddings_created?: number
          error?: string | null
          id?: string
          pages_processed?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_aid_authorities: {
        Row: {
          address: string | null
          created_at: string
          display_order: number
          district: string | null
          id: string
          is_demo: boolean
          last_verified_date: string | null
          level: string
          name: string
          phone: string | null
          source_reference: string
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          display_order?: number
          district?: string | null
          id?: string
          is_demo?: boolean
          last_verified_date?: string | null
          level: string
          name: string
          phone?: string | null
          source_reference: string
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          display_order?: number
          district?: string | null
          id?: string
          is_demo?: boolean
          last_verified_date?: string | null
          level?: string
          name?: string
          phone?: string | null
          source_reference?: string
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      legal_document_chunks: {
        Row: {
          act_name: string
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_model: string | null
          id: string
          language: string
          section_number: string | null
          section_title: string | null
        }
        Insert: {
          act_name: string
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          language?: string
          section_number?: string | null
          section_title?: string | null
        }
        Update: {
          act_name?: string
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          language?: string
          section_number?: string | null
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          notes: string | null
          replaced_by: string | null
          source_title: string | null
          source_url: string | null
          version: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          notes?: string | null
          replaced_by?: string | null
          source_title?: string | null
          source_url?: string | null
          version: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          notes?: string | null
          replaced_by?: string | null
          source_title?: string | null
          source_url?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          act_name: string
          category: string
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          is_demo: boolean
          language: string
          source_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          version: string
        }
        Insert: {
          act_name: string
          category?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_demo?: boolean
          language?: string
          source_id?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Update: {
          act_name?: string
          category?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_demo?: boolean
          language?: string
          source_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "legal_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_sources: {
        Row: {
          created_at: string
          document_type: string
          id: string
          is_demo: boolean
          notes: string | null
          source_url: string | null
          title: string
          updated_at: string
          verified: boolean
          verified_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          version?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          note: string | null
          ref_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          note?: string | null
          ref_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          note?: string | null
          ref_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      scheme_eligibility_responses: {
        Row: {
          created_at: string
          id: string
          recommended_scheme_ids: Json
          responses: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommended_scheme_ids?: Json
          responses?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recommended_scheme_ids?: Json
          responses?: Json
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_legal_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          act_name: string
          chunk_id: string
          content: string
          document_id: string
          document_title: string
          document_version: string
          is_demo: boolean
          section_number: string
          section_title: string
          similarity: number
          source_title: string
          source_version: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
