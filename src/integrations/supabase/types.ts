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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      courses: {
        Row: {
          creado_en: string
          creado_por: string | null
          description: string | null
          id: string
          url_imagen: string | null
          publicado: boolean | null
          title: string
          actualizado_en: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          description?: string | null
          id?: string
          url_imagen?: string | null
          publicado?: boolean | null
          title: string
          actualizado_en?: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          description?: string | null
          id?: string
          url_imagen?: string | null
          publicado?: boolean | null
          title?: string
          actualizado_en?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completado_en: string | null
          curso_id: string
          inscripto_en: string
          id: string
          usuario_id: string
        }
        Insert: {
          completado_en?: string | null
          curso_id: string
          inscripto_en?: string
          id?: string
          usuario_id: string
        }
        Update: {
          completado_en?: string | null
          curso_id?: string
          inscripto_en?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          content: Json
          creado_en: string
          description: string | null
          orden: number
          tipo: string
          id: string
          leccion_id: string
          title: string
        }
        Insert: {
          content?: Json
          creado_en?: string
          description?: string | null
          orden?: number
          tipo?: string
          id?: string
          leccion_id: string
          title: string
        }
        Update: {
          content?: Json
          creado_en?: string
          description?: string | null
          orden?: number
          tipo?: string
          id?: string
          leccion_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_lesson_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "lecciones"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completado: boolean | null
          completado_en: string | null
          id: string
          leccion_id: string
          usuario_id: string
        }
        Insert: {
          completado?: boolean | null
          completado_en?: string | null
          id?: string
          leccion_id: string
          usuario_id: string
        }
        Update: {
          completado?: boolean | null
          completado_en?: string | null
          id?: string
          leccion_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "lecciones"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          curso_id: string
          creado_en: string
          description: string | null
          id: string
          sala_jitsi: string | null
          orden: number
          title: string
          fecha_desbloqueo: string | null
          actualizado_en: string
          url_video: string | null
        }
        Insert: {
          content?: string | null
          curso_id: string
          creado_en?: string
          description?: string | null
          id?: string
          sala_jitsi?: string | null
          orden?: number
          title: string
          fecha_desbloqueo?: string | null
          actualizado_en?: string
          url_video?: string | null
        }
        Update: {
          content?: string | null
          curso_id?: string
          creado_en?: string
          description?: string | null
          id?: string
          sala_jitsi?: string | null
          orden?: number
          title?: string
          fecha_desbloqueo?: string | null
          actualizado_en?: string
          url_video?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          url_avatar: string | null
          biografia: string | null
          creado_en: string
          nombre_completo: string | null
          id: string
          telefono: string | null
          actualizado_en: string
        }
        Insert: {
          url_avatar?: string | null
          biografia?: string | null
          creado_en?: string
          nombre_completo?: string | null
          id: string
          telefono?: string | null
          actualizado_en?: string
        }
        Update: {
          url_avatar?: string | null
          biografia?: string | null
          creado_en?: string
          nombre_completo?: string | null
          id?: string
          telefono?: string | null
          actualizado_en?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          creado_en: string
          currency: string | null
          fin_en: string | null
          id: string
          id_pago: string | null
          proveedor_pago: string | null
          nombre_plan: string
          price: number | null
          inicio_en: string
          status: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          currency?: string | null
          fin_en?: string | null
          id?: string
          id_pago?: string | null
          proveedor_pago?: string | null
          nombre_plan: string
          price?: number | null
          inicio_en?: string
          status?: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          currency?: string | null
          fin_en?: string | null
          id?: string
          id_pago?: string | null
          proveedor_pago?: string | null
          nombre_plan?: string
          price?: number | null
          inicio_en?: string
          status?: string
          usuario_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          usuario_id?: string
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
    }
    Enums: {
      app_role: "admin" | "student" | "teacher"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "student", "teacher"],
    },
  },
} as const