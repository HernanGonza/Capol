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
      cursos: {
        Row: {
          actualizado_en: string | null
          creado_en: string | null
          creado_por: string | null
          descripcion: string | null
          id: string
          publicado: boolean | null
          tipo_flyer: string | null
          titulo: string
          url_flyer: string | null
          url_imagen: string | null
        }
        Insert: {
          actualizado_en?: string | null
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          publicado?: boolean | null
          tipo_flyer?: string | null
          titulo: string
          url_flyer?: string | null
          url_imagen?: string | null
        }
        Update: {
          actualizado_en?: string | null
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          publicado?: boolean | null
          tipo_flyer?: string | null
          titulo?: string
          url_flyer?: string | null
          url_imagen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      docentes_cursos: {
        Row: {
          asignado_en: string | null
          curso_id: string
          docente_id: string
          id: string
        }
        Insert: {
          asignado_en?: string | null
          curso_id: string
          docente_id: string
          id?: string
        }
        Update: {
          asignado_en?: string | null
          curso_id?: string
          docente_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_teachers_course_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_teachers_teacher_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ejercicios: {
        Row: {
          content: Json | null
          creado_en: string | null
          descripcion: string | null
          id: string
          leccion_id: string | null
          orden: number | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          content?: Json | null
          creado_en?: string | null
          descripcion?: string | null
          id?: string
          leccion_id?: string | null
          orden?: number | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          content?: Json | null
          creado_en?: string | null
          descripcion?: string | null
          id?: string
          leccion_id?: string | null
          orden?: number | null
          tipo?: string | null
          titulo?: string
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
      inscripciones: {
        Row: {
          completado_en: string | null
          curso_id: string | null
          id: string
          inscripto_en: string | null
          usuario_id: string | null
        }
        Insert: {
          completado_en?: string | null
          curso_id?: string | null
          id?: string
          inscripto_en?: string | null
          usuario_id?: string | null
        }
        Update: {
          completado_en?: string | null
          curso_id?: string | null
          id?: string
          inscripto_en?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lecciones: {
        Row: {
          actualizado_en: string | null
          content: string | null
          creado_en: string | null
          curso_id: string | null
          descripcion: string | null
          fecha_desbloqueo: string | null
          id: string
          orden: number | null
          sala_jitsi: string | null
          titulo: string
          url_video: string | null
        }
        Insert: {
          actualizado_en?: string | null
          content?: string | null
          creado_en?: string | null
          curso_id?: string | null
          descripcion?: string | null
          fecha_desbloqueo?: string | null
          id?: string
          orden?: number | null
          sala_jitsi?: string | null
          titulo: string
          url_video?: string | null
        }
        Update: {
          actualizado_en?: string | null
          content?: string | null
          creado_en?: string | null
          curso_id?: string | null
          descripcion?: string | null
          fecha_desbloqueo?: string | null
          id?: string
          orden?: number | null
          sala_jitsi?: string | null
          titulo?: string
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
      perfiles: {
        Row: {
          actualizado_en: string | null
          biografia: string | null
          creado_en: string | null
          id: string
          nombre_completo: string | null
          telefono: string | null
          url_avatar: string | null
        }
        Insert: {
          actualizado_en?: string | null
          biografia?: string | null
          creado_en?: string | null
          id: string
          nombre_completo?: string | null
          telefono?: string | null
          url_avatar?: string | null
        }
        Update: {
          actualizado_en?: string | null
          biografia?: string | null
          creado_en?: string | null
          id?: string
          nombre_completo?: string | null
          telefono?: string | null
          url_avatar?: string | null
        }
        Relationships: []
      }
      progreso_lecciones: {
        Row: {
          completado: boolean | null
          completado_en: string | null
          id: string
          leccion_id: string | null
          usuario_id: string | null
        }
        Insert: {
          completado?: boolean | null
          completado_en?: string | null
          id?: string
          leccion_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          completado?: boolean | null
          completado_en?: string | null
          id?: string
          leccion_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "lecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_usuario: {
        Row: {
          id: string
          rol: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Insert: {
          id?: string
          rol?: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Update: {
          id?: string
          rol?: Database["public"]["Enums"]["app_role"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripciones: {
        Row: {
          creado_en: string | null
          curso_id: string | null
          estado: string | null
          fin_en: string | null
          id: string
          id_pago: string | null
          inicio_en: string | null
          moneda: string | null
          nombre_plan: string | null
          price: number | null
          proveedor_pago: string | null
          proxima_fecha_pago: string | null
          usuario_id: string | null
        }
        Insert: {
          creado_en?: string | null
          curso_id?: string | null
          estado?: string | null
          fin_en?: string | null
          id?: string
          id_pago?: string | null
          inicio_en?: string | null
          moneda?: string | null
          nombre_plan?: string | null
          price?: number | null
          proveedor_pago?: string | null
          proxima_fecha_pago?: string | null
          usuario_id?: string | null
        }
        Update: {
          creado_en?: string | null
          curso_id?: string | null
          estado?: string | null
          fin_en?: string | null
          id?: string
          id_pago?: string | null
          inicio_en?: string | null
          moneda?: string | null
          nombre_plan?: string | null
          price?: number | null
          proveedor_pago?: string | null
          proxima_fecha_pago?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_course_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          role_to_check: Database["public"]["Enums"]["app_role"]
          user_id: string
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