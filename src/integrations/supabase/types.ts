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
      alertas_seguridad: {
        Row: {
          creado_en: string
          datos: Json | null
          detalle: string
          id: string
          resuelta: boolean
          resuelta_en: string | null
          tipo: string
        }
        Insert: {
          creado_en?: string
          datos?: Json | null
          detalle: string
          id?: string
          resuelta?: boolean
          resuelta_en?: string | null
          tipo: string
        }
        Update: {
          creado_en?: string
          datos?: Json | null
          detalle?: string
          id?: string
          resuelta?: boolean
          resuelta_en?: string | null
          tipo?: string
        }
        Relationships: []
      }
      configuracion_financiera: {
        Row: {
          actualizado_en: string
          costo_plataforma_ars: number
          costo_publicidad_ars: number
          dia_corte: number
          id: boolean
        }
        Insert: {
          actualizado_en?: string
          costo_plataforma_ars?: number
          costo_publicidad_ars?: number
          dia_corte?: number
          id?: boolean
        }
        Update: {
          actualizado_en?: string
          costo_plataforma_ars?: number
          costo_publicidad_ars?: number
          dia_corte?: number
          id?: boolean
        }
        Relationships: []
      }
      configuracion_global: {
        Row: {
          actualizado_en: string | null
          clave: string
          valor: Json
        }
        Insert: {
          actualizado_en?: string | null
          clave: string
          valor: Json
        }
        Update: {
          actualizado_en?: string | null
          clave?: string
          valor?: Json
        }
        Relationships: []
      }
      cortes_plataforma: {
        Row: {
          curso_id: string
          id: string
          monto_plataforma: number
          monto_profesor: number
          notas: string | null
          pagado_en: string
          periodo_fin: string
          periodo_inicio: string
          periodo_mes: string
        }
        Insert: {
          curso_id: string
          id?: string
          monto_plataforma?: number
          monto_profesor?: number
          notas?: string | null
          pagado_en?: string
          periodo_fin: string
          periodo_inicio: string
          periodo_mes: string
        }
        Update: {
          curso_id?: string
          id?: string
          monto_plataforma?: number
          monto_profesor?: number
          notas?: string | null
          pagado_en?: string
          periodo_fin?: string
          periodo_inicio?: string
          periodo_mes?: string
        }
        Relationships: [
          {
            foreignKeyName: "cortes_plataforma_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          actualizado_en: string | null
          cantidad_cuotas: number | null
          carga_horaria: number | null
          cotizacion_ars: number | null
          creado_en: string | null
          creado_por: string | null
          descripcion: string | null
          duracion: string | null
          estado: Database["public"]["Enums"]["curso_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          grupo_id: string | null
          horarios: string | null
          id: string
          modalidad: Database["public"]["Enums"]["curso_modalidad"]
          moneda: string | null
          precio: number | null
          publicado: boolean | null
          tipo_flyer: string | null
          tipo_precio: string | null
          titulo: string
          url_flyer: string | null
          url_imagen: string | null
        }
        Insert: {
          actualizado_en?: string | null
          cantidad_cuotas?: number | null
          carga_horaria?: number | null
          cotizacion_ars?: number | null
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string | null
          duracion?: string | null
          estado?: Database["public"]["Enums"]["curso_estado"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          grupo_id?: string | null
          horarios?: string | null
          id?: string
          modalidad?: Database["public"]["Enums"]["curso_modalidad"]
          moneda?: string | null
          precio?: number | null
          publicado?: boolean | null
          tipo_flyer?: string | null
          tipo_precio?: string | null
          titulo: string
          url_flyer?: string | null
          url_imagen?: string | null
        }
        Update: {
          actualizado_en?: string | null
          cantidad_cuotas?: number | null
          carga_horaria?: number | null
          cotizacion_ars?: number | null
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string | null
          duracion?: string | null
          estado?: Database["public"]["Enums"]["curso_estado"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          grupo_id?: string | null
          horarios?: string | null
          id?: string
          modalidad?: Database["public"]["Enums"]["curso_modalidad"]
          moneda?: string | null
          precio?: number | null
          publicado?: boolean | null
          tipo_flyer?: string | null
          tipo_precio?: string | null
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
          {
            foreignKeyName: "cursos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "cursos"
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
      entregas_trabajo_final: {
        Row: {
          creado_en: string
          id: string
          leccion_id: string
          nombre_archivo: string | null
          tipo: string
          url: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          leccion_id: string
          nombre_archivo?: string | null
          tipo: string
          url: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          leccion_id?: string
          nombre_archivo?: string | null
          tipo?: string
          url?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_trabajo_final_leccion_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "lecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_trabajo_final_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      errores_cliente: {
        Row: {
          component_stack: string | null
          creado_en: string
          id: string
          mensaje: string
          stack: string | null
          url: string | null
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          component_stack?: string | null
          creado_en?: string
          id?: string
          mensaje: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          component_stack?: string | null
          creado_en?: string
          id?: string
          mensaje?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "errores_cliente_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foro_ultima_lectura: {
        Row: {
          curso_id: string
          leido_hasta: string
          usuario_id: string
        }
        Insert: {
          curso_id: string
          leido_hasta?: string
          usuario_id: string
        }
        Update: {
          curso_id?: string
          leido_hasta?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foro_ultima_lectura_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_ultima_lectura_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
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
      landing_visits: {
        Row: {
          id: string
          ip: string | null
          pais_code: string | null
          user_agent: string | null
          visited_at: string
          visitor_id: string | null
        }
        Insert: {
          id?: string
          ip?: string | null
          pais_code?: string | null
          user_agent?: string | null
          visited_at?: string
          visitor_id?: string | null
        }
        Update: {
          id?: string
          ip?: string | null
          pais_code?: string | null
          user_agent?: string | null
          visited_at?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      lecciones: {
        Row: {
          actualizado_en: string | null
          clase_iniciada_en: string | null
          content: string | null
          creado_en: string | null
          curso_id: string | null
          descripcion: string | null
          fecha_desbloqueo: string | null
          fecha_fin_clase: string | null
          grabacion_url: string | null
          id: string
          orden: number | null
          sala_jitsi: string | null
          titulo: string
          url_video: string | null
        }
        Insert: {
          actualizado_en?: string | null
          clase_iniciada_en?: string | null
          content?: string | null
          creado_en?: string | null
          curso_id?: string | null
          descripcion?: string | null
          fecha_desbloqueo?: string | null
          fecha_fin_clase?: string | null
          grabacion_url?: string | null
          id?: string
          orden?: number | null
          sala_jitsi?: string | null
          titulo: string
          url_video?: string | null
        }
        Update: {
          actualizado_en?: string | null
          clase_iniciada_en?: string | null
          content?: string | null
          creado_en?: string | null
          curso_id?: string | null
          descripcion?: string | null
          fecha_desbloqueo?: string | null
          fecha_fin_clase?: string | null
          grabacion_url?: string | null
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
      mensajeria_bloqueados: {
        Row: {
          bloqueado_por: string | null
          creado_en: string
          motivo: string | null
          usuario_id: string
        }
        Insert: {
          bloqueado_por?: string | null
          creado_en?: string
          motivo?: string | null
          usuario_id: string
        }
        Update: {
          bloqueado_por?: string | null
          creado_en?: string
          motivo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajeria_bloqueados_bloqueado_por_fkey"
            columns: ["bloqueado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajeria_bloqueados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          adjunto_nombre: string | null
          adjunto_path: string | null
          contenido: string
          creado_en: string
          curso_id: string | null
          destinatario_id: string | null
          editado: boolean
          eliminado: boolean
          fijado: boolean
          id: string
          leido: boolean
          remitente_id: string
        }
        Insert: {
          adjunto_nombre?: string | null
          adjunto_path?: string | null
          contenido: string
          creado_en?: string
          curso_id?: string | null
          destinatario_id?: string | null
          editado?: boolean
          eliminado?: boolean
          fijado?: boolean
          id?: string
          leido?: boolean
          remitente_id: string
        }
        Update: {
          adjunto_nombre?: string | null
          adjunto_path?: string | null
          contenido?: string
          creado_en?: string
          curso_id?: string | null
          destinatario_id?: string | null
          editado?: boolean
          eliminado?: boolean
          fijado?: boolean
          id?: string
          leido?: boolean
          remitente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_remitente_id_fkey"
            columns: ["remitente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_contacto: {
        Row: {
          creado_en: string
          email: string
          id: string
          leido: boolean
          mensaje: string
          nombre: string
        }
        Insert: {
          creado_en?: string
          email: string
          id?: string
          leido?: boolean
          mensaje: string
          nombre: string
        }
        Update: {
          creado_en?: string
          email?: string
          id?: string
          leido?: boolean
          mensaje?: string
          nombre?: string
        }
        Relationships: []
      }
      mensajes_reportados: {
        Row: {
          creado_en: string
          id: string
          mensaje_id: string
          motivo: string | null
          reportado_por: string
          resuelto: boolean
        }
        Insert: {
          creado_en?: string
          id?: string
          mensaje_id: string
          motivo?: string | null
          reportado_por: string
          resuelto?: boolean
        }
        Update: {
          creado_en?: string
          id?: string
          mensaje_id?: string
          motivo?: string | null
          reportado_por?: string
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_reportados_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_reportados_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          costo_plataforma_ars: number
          costo_publicidad_ars: number
          curso_id: string
          id: string
          monto: number
          pagado_en: string
          suscripcion_id: string | null
          usuario_id: string
        }
        Insert: {
          costo_plataforma_ars: number
          costo_publicidad_ars: number
          curso_id: string
          id?: string
          monto: number
          pagado_en?: string
          suscripcion_id?: string | null
          usuario_id: string
        }
        Update: {
          costo_plataforma_ars?: number
          costo_publicidad_ars?: number
          curso_id?: string
          id?: string
          monto?: number
          pagado_en?: string
          suscripcion_id?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_suscripcion_id_fkey"
            columns: ["suscripcion_id"]
            isOneToOne: false
            referencedRelation: "suscripciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          actualizado_en: string | null
          bienvenida_vista: boolean
          biografia: string | null
          creado_en: string | null
          direccion: string | null
          dni: string | null
          edad: number | null
          email: string | null
          firma_url: string | null
          id: string
          localidad: string | null
          nombre_completo: string | null
          ocupacion: string | null
          pais: string | null
          pais_ip: string | null
          provincia: string | null
          telefono: string | null
          tour_completado: boolean
          url_avatar: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string | null
          bienvenida_vista?: boolean
          biografia?: string | null
          creado_en?: string | null
          direccion?: string | null
          dni?: string | null
          edad?: number | null
          email?: string | null
          firma_url?: string | null
          id: string
          localidad?: string | null
          nombre_completo?: string | null
          ocupacion?: string | null
          pais?: string | null
          pais_ip?: string | null
          provincia?: string | null
          telefono?: string | null
          tour_completado?: boolean
          url_avatar?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string | null
          bienvenida_vista?: boolean
          biografia?: string | null
          creado_en?: string | null
          direccion?: string | null
          dni?: string | null
          edad?: number | null
          email?: string | null
          firma_url?: string | null
          id?: string
          localidad?: string | null
          nombre_completo?: string | null
          ocupacion?: string | null
          pais?: string | null
          pais_ip?: string | null
          provincia?: string | null
          telefono?: string | null
          tour_completado?: boolean
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
      solicitudes_inscripcion: {
        Row: {
          creado_en: string | null
          curso_id: string
          estado: string | null
          id: string
          mensaje: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          usuario_id: string
        }
        Insert: {
          creado_en?: string | null
          curso_id: string
          estado?: string | null
          id?: string
          mensaje?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          usuario_id: string
        }
        Update: {
          creado_en?: string | null
          curso_id?: string
          estado?: string | null
          id?: string
          mensaje?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_inscripcion_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_inscripcion_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_inscripcion_usuario_id_fkey"
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
      contar_alumnos_totales: { Args: never; Returns: number }
      contar_inscritos_por_curso: {
        Args: never
        Returns: {
          cantidad: number
          curso_id: string
        }[]
      }
      contar_lecciones_por_curso: {
        Args: never
        Returns: {
          cantidad: number
          curso_id: string
        }[]
      }
      contar_registrados_totales: { Args: never; Returns: number }
      registrar_pago_suscripcion: {
        Args: {
          p_curso_id: string
          p_monto: number
          p_proveedor_pago: string | null
          p_usuario_id: string
        }
        Returns: string
      }
      dentro_de_cooldown_mensajes: {
        Args: { p_remitente: string }
        Returns: boolean
      }
      detectar_anomalias_seguridad: { Args: never; Returns: undefined }
      editar_mensaje_propio: {
        Args: { p_contenido: string; p_mensaje_id: string }
        Returns: undefined
      }
      eliminar_mensaje_propio: {
        Args: { p_mensaje_id: string }
        Returns: undefined
      }
      existe_hilo_mensajes: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      fijar_mensaje_foro: {
        Args: { p_fijar: boolean; p_mensaje_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          role_to_check: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Returns: boolean
      }
      mis_contactos_mensajeria: {
        Args: never
        Returns: {
          curso_titulo: string
          id: string
          nombre_completo: string
          rol: string
          url_avatar: string
        }[]
      }
      obtener_temario_curso: {
        Args: { curso_id_param: string }
        Returns: {
          id: string
          orden: number
          titulo: string
        }[]
      }
      perfiles_publicos: {
        Args: { p_ids: string[] }
        Returns: {
          firma_url: string
          id: string
          nombre_completo: string
          url_avatar: string
        }[]
      }
      primer_orden_leccion: {
        Args: { curso_id_param: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "student" | "teacher"
      curso_estado: "proximamente" | "activo" | "finalizado"
      curso_modalidad: "en_vivo" | "grabado"
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
      curso_estado: ["proximamente", "activo", "finalizado"],
      curso_modalidad: ["en_vivo", "grabado"],
    },
  },
} as const
