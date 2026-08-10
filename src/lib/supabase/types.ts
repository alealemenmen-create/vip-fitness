// Tipado manual del esquema (supabase/migrations/0001_init.sql).
// Cuando el proyecto Supabase real exista, se puede regenerar con:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Por ahora se mantiene a mano para no depender de un proyecto ya creado.

export type Rol = "alumno" | "entrenador" | "admin";
// 0032: sexo declarado en el registro, editable después desde "Mi perfil".
export type Sexo = "femenino" | "masculino" | "otro";
export type EstadoSolicitud = "pendiente" | "aceptada" | "rechazada";
export type EstadoSesion = "en_progreso" | "completada" | "finalizada_incompleta" | "abandonada";
// "otro" viene de 0027: documentos que no son ni rutina ni plan de comidas.
export type TipoDocumento = "rutina" | "alimentacion" | "otro";
export type CategoriaFoto = "frontal" | "lateral" | "espalda" | "otra";
export type TorneoMetrica = "peso_baja" | "peso_sube" | "asistencia" | "progreso_vip" | "manual";
export type TorneoModalidad = "duelo" | "reto_coach" | "copa_constancia";
export type TorneoParticipanteEstado = "pendiente" | "aceptado" | "rechazado";
export type CategoriaReconocimiento =
  | "entrenamiento"
  | "alimentacion"
  | "ranking"
  | "constancia";
/** Forma del desglose de puntos del ranking guardado como jsonb (ver DesgloseSemana en lib/ranking/puntos.ts). */
export type DesgloseSemanaJSON = {
  asistencia: number;
  alimentacion: number;
  app: number;
  total: number;
  totalCrudo: number;
};
export type CategoriaPuntosVIP =
  | "entrenamiento"
  | "alimentacion"
  | "progreso"
  | "constancia"
  | "competencia"
  | "ajuste";
export type MetadataPuntosVIP = Record<string, unknown>;
// 0043_impulso_vip.sql — motor de progresión (doble progresión).
export type DificultadPercibidaImpulso = "muy_facil" | "facil" | "justo" | "dificil" | "fallo";
export type TipoProgresionImpulso = "doble" | "solo_peso" | "solo_reps" | "manual";
export type ReglaImpulso = "A_subir_reps" | "B_subir_peso" | "C_mantener" | "D_reducir" | "E_consultar";
export type EstadoRecomendacionImpulso = "propuesta" | "aprobada" | "bloqueada" | "modificada";
export type CumplimientoImpulso = "cumplida" | "superada" | "parcial" | "no_cumplida";
export type DecisionDataImpulso = Record<string, unknown>;
export type TipoAlertaImpulso = "dolor" | "estancamiento_3_sesiones" | "caida_rendimiento";
export type MomentoAlertaImpulso = "antes" | "durante" | "despues";
export type EstadoAlertaImpulso = "pendiente" | "vista" | "resuelta";
export type EstadoReporteFotoEjercicio = "pendiente" | "resuelto";
/** Forma de cada fila del snapshot de resultados de un torneo (ver ResultadoTorneo en lib/torneos/puntos.ts). */
export type ResultadoTorneoJSON = {
  alumnoId: string;
  nombre: string;
  valor: number;
  puesto: number;
  puntosDelta: number;
  valido?: boolean;
};

export interface Database {
  public: {
    Tables: {
      perfiles: {
        Row: { id: string; nombre: string; rol: Rol; created_at: string };
        Insert: { id: string; nombre: string; rol: Rol; created_at?: string };
        Update: { nombre?: string; rol?: Rol };
        Relationships: [];
      };
      alumno_perfil: {
        Row: {
          user_id: string;
          entrenador_id: string | null;
          objetivo: string | null;
          fecha_ingreso: string;
          proximo_control_fecha: string | null;
          fecha_nacimiento: string | null;
          estatura_cm: number | null;
          condicion_medica: string | null;
          restriccion_alimenticia: string | null;
          // 0018_anuncios.sql
          noticias_vistas_en: string | null;
          // 0024_tema_boton.sql
          tema_boton: string | null;
          // 0032_solicitudes_registro.sql
          telefono: string | null;
          sexo: Sexo | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          entrenador_id?: string | null;
          objetivo?: string | null;
          fecha_ingreso?: string;
          proximo_control_fecha?: string | null;
          fecha_nacimiento?: string | null;
          estatura_cm?: number | null;
          condicion_medica?: string | null;
          restriccion_alimenticia?: string | null;
          noticias_vistas_en?: string | null;
          tema_boton?: string | null;
          telefono?: string | null;
          sexo?: Sexo | null;
        };
        Update: {
          entrenador_id?: string | null;
          objetivo?: string | null;
          proximo_control_fecha?: string | null;
          fecha_nacimiento?: string | null;
          estatura_cm?: number | null;
          condicion_medica?: string | null;
          restriccion_alimenticia?: string | null;
          noticias_vistas_en?: string | null;
          tema_boton?: string | null;
          telefono?: string | null;
          sexo?: Sexo | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alumno_perfil_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumno_perfil_entrenador_id_fkey";
            columns: ["entrenador_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0032_solicitudes_registro.sql — altas que llegan por el link público.
      solicitudes_registro: {
        Row: {
          id: string;
          nombre: string;
          email: string;
          telefono: string;
          fecha_nacimiento: string | null;
          sexo: Sexo | null;
          estatura_cm: number | null;
          peso_kg: number | null;
          objetivo: string | null;
          condicion_medica: string | null;
          restriccion_alimenticia: string | null;
          mensaje: string | null;
          estado: EstadoSolicitud;
          revisada_por: string | null;
          revisada_en: string | null;
          motivo_rechazo: string | null;
          alumno_id: string | null;
          // 0033_registro_pago.sql
          comprobante_path: string | null;
          comprobante_subido_en: string | null;
          pago_verificado: boolean;
          pago_verificado_por: string | null;
          pago_verificado_en: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          email: string;
          telefono: string;
          fecha_nacimiento?: string | null;
          sexo?: Sexo | null;
          estatura_cm?: number | null;
          peso_kg?: number | null;
          objetivo?: string | null;
          condicion_medica?: string | null;
          restriccion_alimenticia?: string | null;
          mensaje?: string | null;
          estado?: EstadoSolicitud;
        };
        Update: {
          // El entrenador puede corregir el contacto de una solicitud
          // pendiente (un dedazo en el correo la deja inaceptable).
          email?: string;
          telefono?: string;
          estado?: EstadoSolicitud;
          revisada_por?: string | null;
          revisada_en?: string | null;
          motivo_rechazo?: string | null;
          alumno_id?: string | null;
          comprobante_path?: string | null;
          comprobante_subido_en?: string | null;
          pago_verificado?: boolean;
          pago_verificado_por?: string | null;
          pago_verificado_en?: string | null;
        };
        Relationships: [];
      };
      notas_entrenador: {
        Row: {
          id: string;
          alumno_id: string;
          entrenador_id: string;
          texto: string;
          fecha_inicio: string;
          fecha_fin: string | null;
          marcar_nueva: boolean;
          importante: boolean;
          leida_en: string | null;
          generado_con_ia: boolean;
          clave_origen: string | null;
          autor: "entrenador" | "alumno";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          alumno_id: string;
          entrenador_id: string;
          texto: string;
          fecha_inicio?: string;
          fecha_fin?: string | null;
          marcar_nueva?: boolean;
          importante?: boolean;
          generado_con_ia?: boolean;
          clave_origen?: string | null;
          autor?: "entrenador" | "alumno";
        };
        Update: {
          texto?: string;
          fecha_inicio?: string;
          fecha_fin?: string | null;
          marcar_nueva?: boolean;
          importante?: boolean;
          leida_en?: string | null;
          generado_con_ia?: boolean;
          clave_origen?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notas_entrenador_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0018_anuncios.sql, 0019_anuncio_importante.sql
      anuncios: {
        Row: {
          id: string;
          titulo: string;
          mensaje: string;
          creado_por: string | null;
          importante: boolean;
          created_at: string;
        };
        Insert: {
          titulo: string;
          mensaje: string;
          creado_por?: string | null;
          importante?: boolean;
        };
        Update: {
          titulo?: string;
          mensaje?: string;
          importante?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "anuncios_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0020_reconocimientos_ia.sql
      configuracion_gimnasio: {
        Row: {
          id: boolean;
          reconocimientos_activos: boolean;
          max_reconocimientos_semana: number;
          min_puntaje_reconocimiento: number;
          incluir_entrenamiento: boolean;
          incluir_alimentacion: boolean;
          incluir_ranking: boolean;
          incluir_constancia: boolean;
          dias_sin_entrenar_alerta: number;
          pct_entrenamiento_atencion: number;
          pct_entrenamiento_destacado: number;
          dias_comida_atencion: number;
          dias_comida_destacado: number;
          // 0033_registro_pago.sql
          registro_beta_aviso: boolean;
          pago_registro_activo: boolean;
          pago_monto: number | null;
          pago_banco: string | null;
          pago_tipo_cuenta: string | null;
          pago_numero_cuenta: string | null;
          pago_rut: string | null;
          pago_titular: string | null;
          pago_correo: string | null;
          pago_instrucciones: string | null;
          whatsapp_gimnasio: string | null;
          asistente_ia_activo: boolean;
          presupuesto_ia_mensual_usd: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          reconocimientos_activos?: boolean;
          max_reconocimientos_semana?: number;
          min_puntaje_reconocimiento?: number;
          incluir_entrenamiento?: boolean;
          incluir_alimentacion?: boolean;
          incluir_ranking?: boolean;
          incluir_constancia?: boolean;
          dias_sin_entrenar_alerta?: number;
          pct_entrenamiento_atencion?: number;
          pct_entrenamiento_destacado?: number;
          dias_comida_atencion?: number;
          dias_comida_destacado?: number;
          registro_beta_aviso?: boolean;
          pago_registro_activo?: boolean;
          pago_monto?: number | null;
          pago_banco?: string | null;
          pago_tipo_cuenta?: string | null;
          pago_numero_cuenta?: string | null;
          pago_rut?: string | null;
          pago_titular?: string | null;
          pago_correo?: string | null;
          pago_instrucciones?: string | null;
          whatsapp_gimnasio?: string | null;
          asistente_ia_activo?: boolean;
          presupuesto_ia_mensual_usd?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["configuracion_gimnasio"]["Insert"]>;
        Relationships: [];
      };
      asistente_uso_ia: {
        Row: {
          id: string;
          usuario_id: string;
          herramienta: "atencion" | "nutricion" | "entrenamiento" | "progreso" | "noticia" | "alumno" | "eliminar_datos";
          modelo: string;
          tokens_entrada: number;
          tokens_salida: number;
          costo_usd: number;
          created_at: string;
        };
        Insert: {
          usuario_id: string;
          herramienta: "atencion" | "nutricion" | "entrenamiento" | "progreso" | "noticia" | "alumno" | "eliminar_datos";
          modelo: string;
          tokens_entrada?: number;
          tokens_salida?: number;
          costo_usd?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["asistente_uso_ia"]["Insert"]>;
        Relationships: [];
      };
      borradores_noticias: {
        Row: {
          id: string;
          titulo: string;
          mensaje: string;
          estado: "pendiente" | "publicado" | "descartado";
          creado_por: string;
          generado_con_ia: boolean;
          publicado_en: string | null;
          created_at: string;
        };
        Insert: {
          titulo: string;
          mensaje: string;
          estado?: "pendiente" | "publicado" | "descartado";
          creado_por: string;
          generado_con_ia?: boolean;
          publicado_en?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["borradores_noticias"]["Insert"]>;
        Relationships: [];
      };
      // 0041_solicitudes_eliminacion_datos.sql — propuesta de borrado del
      // Asistente VIP: la IA solo llega a "pendiente", nunca borra sola.
      solicitudes_eliminacion_datos: {
        Row: {
          id: string;
          alumno_id: string;
          categoria: "entrenamiento" | "comida" | "progreso" | "ranking";
          resumen: { tabla: string; etiqueta: string; cantidad: number }[];
          estado: "pendiente" | "confirmado" | "cancelado";
          creado_por: string;
          generado_con_ia: boolean;
          confirmado_por: string | null;
          confirmado_en: string | null;
          created_at: string;
        };
        Insert: {
          alumno_id: string;
          categoria: "entrenamiento" | "comida" | "progreso" | "ranking";
          resumen: { tabla: string; etiqueta: string; cantidad: number }[];
          estado?: "pendiente" | "confirmado" | "cancelado";
          creado_por: string;
          generado_con_ia?: boolean;
        };
        Update: {
          estado?: "pendiente" | "confirmado" | "cancelado";
          confirmado_por?: string | null;
          confirmado_en?: string | null;
        };
        Relationships: [];
      };
      medidas_corporales: {
        Row: {
          id: string;
          alumno_id: string;
          fecha: string;
          cintura_cm: number | null;
          cadera_cm: number | null;
          pecho_cm: number | null;
          brazo_cm: number | null;
          muslo_cm: number | null;
          observacion: string | null;
          registrado_por: string | null;
          created_at: string;
        };
        Insert: {
          alumno_id: string;
          fecha?: string;
          cintura_cm?: number | null;
          cadera_cm?: number | null;
          pecho_cm?: number | null;
          brazo_cm?: number | null;
          muslo_cm?: number | null;
          observacion?: string | null;
          registrado_por?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["medidas_corporales"]["Insert"]>;
        Relationships: [];
      };
      reconocimientos_semanales: {
        Row: {
          id: string;
          semana_inicio: string;
          alumno_id: string;
          categoria: CategoriaReconocimiento;
          titulo: string;
          mensaje: string;
          puntaje: number;
          metricas: Record<string, number | string | boolean>;
          generado_con_ia: boolean;
          modelo: string | null;
          created_at: string;
        };
        Insert: {
          semana_inicio: string;
          alumno_id: string;
          categoria: CategoriaReconocimiento;
          titulo: string;
          mensaje: string;
          puntaje: number;
          metricas?: Record<string, number | string | boolean>;
          generado_con_ia?: boolean;
          modelo?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reconocimientos_semanales"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reconocimientos_semanales_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      noticias_sistema: {
        Row: {
          id: string;
          clave_origen: string;
          tipo: "bienvenida" | "cumpleanos";
          alumno_id: string | null;
          created_at: string;
        };
        Insert: {
          clave_origen: string;
          tipo: "bienvenida" | "cumpleanos";
          alumno_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["noticias_sistema"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "noticias_sistema_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rutinas: {
        Row: {
          id: string;
          alumno_id: string;
          nombre: string;
          activa: boolean;
          version: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          alumno_id: string;
          nombre: string;
          activa?: boolean;
          version?: number;
          created_by?: string | null;
        };
        Update: { nombre?: string; activa?: boolean; version?: number };
        Relationships: [];
      };
      rutina_dias: {
        Row: {
          id: string;
          rutina_id: string;
          numero_dia: number;
          nombre: string;
          orden: number;
          tipo: "entrenamiento" | "descanso";
          descripcion: string | null;
        };
        Insert: {
          rutina_id: string;
          numero_dia: number;
          nombre: string;
          orden: number;
          tipo?: "entrenamiento" | "descanso";
          descripcion?: string | null;
        };
        Update: { numero_dia?: number; nombre?: string; orden?: number; tipo?: "entrenamiento" | "descanso"; descripcion?: string | null };
        Relationships: [];
      };
      rutina_dia_ejercicios: {
        Row: {
          id: string;
          dia_id: string;
          orden: number;
          nombre: string;
          series_programadas: number;
          reps_programadas: string;
          descanso_segundos: number | null;
          tecnica_tipo: string | null;
          tecnica_instruccion: string | null;
          observacion: string | null;
          grupo_muscular:
            | "pecho"
            | "espalda"
            | "piernas"
            | "hombros"
            | "brazos"
            | "core"
            | "cardio"
            | null;
          // 0026_biblioteca_ejercicios.sql — nullable a propósito: un ejercicio
          // que la IA no logró emparejar se publica igual, con su `nombre`.
          ejercicio_id: string | null;
        };
        Insert: {
          dia_id: string;
          orden: number;
          nombre: string;
          series_programadas: number;
          reps_programadas: string;
          descanso_segundos?: number | null;
          tecnica_tipo?: string | null;
          tecnica_instruccion?: string | null;
          observacion?: string | null;
          grupo_muscular?:
            | "pecho"
            | "espalda"
            | "piernas"
            | "hombros"
            | "brazos"
            | "core"
            | "cardio"
            | null;
          ejercicio_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["rutina_dia_ejercicios"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "rutina_dia_ejercicios_dia_id_fkey";
            columns: ["dia_id"];
            isOneToOne: false;
            referencedRelation: "rutina_dias";
            referencedColumns: ["id"];
          },
        ];
      };
      sesiones_entrenamiento: {
        Row: {
          id: string;
          alumno_id: string;
          rutina_id: string | null;
          dia_id: string | null;
          fecha: string;
          numero_calendario: number | null;
          hora_inicio: string;
          hora_fin: string | null;
          estado: EstadoSesion;
          comentario: string | null;
          // 0040_rutina_iniciada.sql
          rutina_iniciada_en: string | null;
        };
        Insert: {
          alumno_id: string;
          rutina_id?: string | null;
          dia_id?: string | null;
          fecha?: string;
          numero_calendario?: number | null;
          estado?: EstadoSesion;
          comentario?: string | null;
        };
        Update: {
          hora_fin?: string | null;
          estado?: EstadoSesion;
          comentario?: string | null;
          rutina_iniciada_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sesiones_entrenamiento_rutina_id_fkey";
            columns: ["rutina_id"];
            isOneToOne: false;
            referencedRelation: "rutinas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sesiones_entrenamiento_dia_id_fkey";
            columns: ["dia_id"];
            isOneToOne: false;
            referencedRelation: "rutina_dias";
            referencedColumns: ["id"];
          },
        ];
      };
      sesion_ejercicios: {
        Row: {
          id: string;
          sesion_id: string;
          dia_ejercicio_id: string;
          completado: boolean;
          completado_en: string | null;
          nota: string | null;
          // 0043_impulso_vip.sql — una vez por ejercicio, no por serie.
          dificultad_percibida: DificultadPercibidaImpulso | null;
        };
        Insert: { sesion_id: string; dia_ejercicio_id: string; completado?: boolean };
        Update: {
          completado?: boolean;
          completado_en?: string | null;
          nota?: string | null;
          dificultad_percibida?: DificultadPercibidaImpulso | null;
        };
        Relationships: [
          {
            foreignKeyName: "sesion_ejercicios_sesion_id_fkey";
            columns: ["sesion_id"];
            isOneToOne: false;
            referencedRelation: "sesiones_entrenamiento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sesion_ejercicios_dia_ejercicio_id_fkey";
            columns: ["dia_ejercicio_id"];
            isOneToOne: false;
            referencedRelation: "rutina_dia_ejercicios";
            referencedColumns: ["id"];
          },
        ];
      };
      series_realizadas: {
        Row: {
          id: string;
          sesion_ejercicio_id: string;
          numero_serie: number;
          peso_kg: number | null;
          es_peso_corporal: boolean;
          reps_realizadas: number | null;
          nota: string | null;
          // 0016_serie_realizada.sql
          realizada: boolean;
        };
        Insert: {
          sesion_ejercicio_id: string;
          numero_serie: number;
          peso_kg?: number | null;
          es_peso_corporal?: boolean;
          reps_realizadas?: number | null;
          nota?: string | null;
          realizada?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["series_realizadas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "series_realizadas_sesion_ejercicio_id_fkey";
            columns: ["sesion_ejercicio_id"];
            isOneToOne: false;
            referencedRelation: "sesion_ejercicios";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0026_biblioteca_ejercicios.sql — biblioteca maestra de ejercicios.
      // `ilustracion_slug` va aparte de `slug` para que varias variantes del
      // mismo movimiento compartan dibujo (press banca / press en Smith).
      ejercicios: {
        Row: {
          id: string;
          slug: string;
          nombre: string;
          aliases: string[];
          grupo_muscular:
            | "pecho"
            | "espalda"
            | "piernas"
            | "hombros"
            | "brazos"
            | "core"
            | "cardio";
          grupos_secundarios: string[];
          categoria:
            | "empuje"
            | "traccion"
            | "pierna"
            | "core"
            | "cardio"
            | "aislamiento"
            | "full_body";
          equipo:
            | "barra"
            | "mancuerna"
            | "polea"
            | "maquina"
            | "smith"
            | "peso_corporal"
            | "kettlebell"
            | "banda"
            | "banco"
            | "otro";
          nivel: "principiante" | "intermedio" | "avanzado";
          descripcion_corta: string | null;
          tecnica: string | null;
          errores_comunes: string[];
          consejos: string[];
          ilustracion_slug: string | null;
          video_url: string | null;
          // 0049_video_cloudflare_stream.sql
          video_cloudflare_uid: string | null;
          video_cloudflare_estado: "subiendo" | "procesando" | "listo" | "error" | null;
          video_cloudflare_duracion_seg: number | null;
          video_cloudflare_miniatura_url: string | null;
          video_cloudflare_error: string | null;
          // 0031_tempo_ejercicios.sql — el tempo es del movimiento, no de la
          // rutina: se calcula una vez por ejercicio y lo reutilizan todas.
          tempo: string | null;
          tempo_nota: string | null;
          tempo_origen: "ia" | "entrenador" | null;
          // 0042_fotos_ejercicios_admin.sql — fotos subidas desde
          // /admin/ejercicios, mandan sobre `ilustracion_slug` cuando existen.
          foto_miniatura_url: string | null;
          foto_panorama_x: number;
          foto_panorama_y: number;
          foto_cuadrada_x: number;
          foto_cuadrada_y: number;
          foto_completa_url: string | null;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          nombre: string;
          aliases?: string[];
          grupo_muscular:
            | "pecho"
            | "espalda"
            | "piernas"
            | "hombros"
            | "brazos"
            | "core"
            | "cardio";
          grupos_secundarios?: string[];
          categoria:
            | "empuje"
            | "traccion"
            | "pierna"
            | "core"
            | "cardio"
            | "aislamiento"
            | "full_body";
          equipo:
            | "barra"
            | "mancuerna"
            | "polea"
            | "maquina"
            | "smith"
            | "peso_corporal"
            | "kettlebell"
            | "banda"
            | "banco"
            | "otro";
          nivel?: "principiante" | "intermedio" | "avanzado";
          descripcion_corta?: string | null;
          tecnica?: string | null;
          errores_comunes?: string[];
          consejos?: string[];
          ilustracion_slug?: string | null;
          video_url?: string | null;
          video_cloudflare_uid?: string | null;
          video_cloudflare_estado?: "subiendo" | "procesando" | "listo" | "error" | null;
          video_cloudflare_duracion_seg?: number | null;
          video_cloudflare_miniatura_url?: string | null;
          video_cloudflare_error?: string | null;
          tempo?: string | null;
          tempo_nota?: string | null;
          tempo_origen?: "ia" | "entrenador" | null;
          foto_miniatura_url?: string | null;
          foto_panorama_x?: number;
          foto_panorama_y?: number;
          foto_cuadrada_x?: number;
          foto_cuadrada_y?: number;
          foto_completa_url?: string | null;
          activo?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["ejercicios"]["Insert"]>;
        Relationships: [];
      };
      alimentos: {
        Row: {
          id: string;
          nombre: string;
          categoria: string | null;
          porcion_base: number;
          unidad: string;
          kcal: number;
          prot: number;
          carb: number;
          grasa: number;
          activo: boolean;
          created_at: string;
          // 0013_medidas_caseras.sql
          medida_nombre: string | null;
          medida_gramos: number | null;
          // 0030_alimentos_aprobacion.sql
          creado_por: string | null;
          aprobado: boolean;
          // 0038_alimentos_open_food_facts.sql
          origen: "catalogo" | "openfoodfacts" | "personalizado";
          off_id: string | null;
          marca: string | null;
          imagen_url: string | null;
          // 0039_alimentos_micronutrientes.sql
          fibra: number | null;
          azucares: number | null;
          sodio: number | null;
        };
        Insert: {
          nombre: string;
          categoria?: string | null;
          porcion_base?: number;
          unidad?: string;
          kcal: number;
          prot?: number;
          carb?: number;
          grasa?: number;
          activo?: boolean;
          medida_nombre?: string | null;
          medida_gramos?: number | null;
          creado_por?: string | null;
          aprobado?: boolean;
          origen?: "catalogo" | "openfoodfacts" | "personalizado";
          off_id?: string | null;
          marca?: string | null;
          imagen_url?: string | null;
          fibra?: number | null;
          azucares?: number | null;
          sodio?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["alimentos"]["Insert"]>;
        Relationships: [];
      };
      registros_diarios: {
        Row: { id: string; alumno_id: string; fecha: string };
        Insert: { alumno_id: string; fecha: string };
        Update: { fecha?: string };
        Relationships: [];
      };
      comidas_registradas: {
        Row: {
          id: string;
          registro_diario_id: string;
          tipo_comida: string;
          omitida: boolean;
          observacion: string | null;
          registrado_en: string | null;
        };
        Insert: {
          registro_diario_id: string;
          tipo_comida: string;
          omitida?: boolean;
          observacion?: string | null;
          registrado_en?: string | null;
        };
        Update: { omitida?: boolean; observacion?: string | null; registrado_en?: string | null };
        Relationships: [
          {
            foreignKeyName: "comidas_registradas_registro_diario_id_fkey";
            columns: ["registro_diario_id"];
            isOneToOne: false;
            referencedRelation: "registros_diarios";
            referencedColumns: ["id"];
          },
        ];
      };
      alimentos_consumidos: {
        Row: { id: string; comida_id: string; alimento_id: string; cantidad: number; unidad: string };
        Insert: { comida_id: string; alimento_id: string; cantidad: number; unidad: string };
        Update: { cantidad?: number; unidad?: string };
        Relationships: [
          {
            foreignKeyName: "alimentos_consumidos_comida_id_fkey";
            columns: ["comida_id"];
            isOneToOne: false;
            referencedRelation: "comidas_registradas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alimentos_consumidos_alimento_id_fkey";
            columns: ["alimento_id"];
            isOneToOne: false;
            referencedRelation: "alimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      pesos_corporales: {
        Row: {
          id: string;
          alumno_id: string;
          peso_kg: number;
          fecha: string;
          hora: string | null;
          registrado_por: string | null;
          observacion: string | null;
          created_at: string;
        };
        Insert: {
          alumno_id: string;
          peso_kg: number;
          fecha?: string;
          hora?: string | null;
          registrado_por: string;
          observacion?: string | null;
        };
        Update: { peso_kg?: number; observacion?: string | null };
        Relationships: [
          {
            foreignKeyName: "pesos_corporales_registrado_por_fkey";
            columns: ["registrado_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fotos_progreso: {
        Row: {
          id: string;
          alumno_id: string;
          storage_path: string;
          fecha_foto: string;
          fecha_carga: string;
          categoria: CategoriaFoto | null;
          comentario: string | null;
        };
        Insert: {
          alumno_id: string;
          storage_path: string;
          fecha_foto?: string;
          categoria?: CategoriaFoto | null;
          comentario?: string | null;
        };
        Update: { fecha_foto?: string; categoria?: CategoriaFoto | null; comentario?: string | null };
        Relationships: [];
      };
      documentos: {
        Row: {
          id: string;
          /** 0027: obsoleta. El archivo ya no pertenece a un alumno — quién lo
           * tiene asignado vive en `documento_asignaciones`. Se conserva solo
           * para que el código viejo no se rompa durante la transición. */
          alumno_id: string | null;
          tipo: TipoDocumento;
          nombre_archivo: string;
          storage_path: string;
          fecha_carga: string;
          fecha_asignacion: string;
          entrenador_id: string | null;
          version: number;
          activo: boolean;
        };
        Insert: {
          alumno_id?: string | null;
          tipo: TipoDocumento;
          nombre_archivo: string;
          storage_path: string;
          fecha_asignacion?: string;
          entrenador_id?: string | null;
          version?: number;
          activo?: boolean;
        };
        Update: {
          activo?: boolean;
          version?: number;
          nombre_archivo?: string;
          storage_path?: string;
          tipo?: TipoDocumento;
        };
        Relationships: [];
      };
      // 0027_documentos_asignaciones.sql
      documento_asignaciones: {
        Row: {
          documento_id: string;
          alumno_id: string;
          fecha_asignacion: string;
          asignado_por: string | null;
          created_at: string;
        };
        Insert: {
          documento_id: string;
          alumno_id: string;
          fecha_asignacion?: string;
          asignado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["documento_asignaciones"]["Insert"]>;
        Relationships: [];
      };
      seguimientos_diarios: {
        Row: {
          id: string;
          alumno_id: string;
          fecha: string;
          entreno_hoy: boolean | null;
          cumplio_alimentacion: boolean | null;
          agua_litros: number | null;
          horas_sueno: number | null;
          energia: number | null;
          molestias: string | null;
          comentario: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          alumno_id: string;
          fecha?: string;
          entreno_hoy?: boolean | null;
          cumplio_alimentacion?: boolean | null;
          agua_litros?: number | null;
          horas_sueno?: number | null;
          energia?: number | null;
          molestias?: string | null;
          comentario?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["seguimientos_diarios"]["Insert"]> & {
          updated_at?: string;
        };
        Relationships: [];
      };
      // 0012_plan_alimentacion.sql — meta calórica extraída del PDF con IA.
      seguimiento_revisiones: {
        Row: {
          id: string;
          alumno_id: string;
          entrenador_id: string;
          desde: string;
          hasta: string;
          dias_periodo: 7 | 14 | 30;
          adherencia_general: number | null;
          resumen: Record<string, unknown>;
          observacion: string;
          decision_siguiente_plan: string | null;
          creado_en: string;
        };
        Insert: {
          alumno_id: string;
          entrenador_id: string;
          desde: string;
          hasta: string;
          dias_periodo: 7 | 14 | 30;
          adherencia_general?: number | null;
          resumen?: Record<string, unknown>;
          observacion: string;
          decision_siguiente_plan?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["seguimiento_revisiones"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "seguimiento_revisiones_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seguimiento_revisiones_entrenador_id_fkey";
            columns: ["entrenador_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      planes_alimentacion: {
        Row: {
          id: string;
          alumno_id: string;
          documento_id: string | null;
          kcal_objetivo: number | null;
          prot_objetivo: number | null;
          carb_objetivo: number | null;
          grasa_objetivo: number | null;
          activo: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          alumno_id: string;
          documento_id?: string | null;
          kcal_objetivo?: number | null;
          prot_objetivo?: number | null;
          carb_objetivo?: number | null;
          grasa_objetivo?: number | null;
          activo?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["planes_alimentacion"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "planes_alimentacion_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_comidas: {
        Row: {
          id: string;
          plan_id: string;
          orden: number;
          nombre: string;
          hora: string | null;
          kcal: number | null;
          descripcion: string | null;
        };
        Insert: {
          plan_id: string;
          orden: number;
          nombre: string;
          hora?: string | null;
          kcal?: number | null;
          descripcion?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["plan_comidas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "plan_comidas_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes_alimentacion";
            referencedColumns: ["id"];
          },
        ];
      };
      puntos_vip_movimientos: {
        Row: {
          id: string;
          alumno_id: string;
          clave: string;
          categoria: CategoriaPuntosVIP;
          puntos: number;
          titulo: string;
          detalle: string | null;
          fecha: string;
          metadata: MetadataPuntosVIP;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          alumno_id: string;
          clave: string;
          categoria: CategoriaPuntosVIP;
          puntos?: number;
          titulo: string;
          detalle?: string | null;
          fecha?: string;
          metadata?: MetadataPuntosVIP;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["puntos_vip_movimientos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "puntos_vip_movimientos_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ranking_semanas: {
        Row: {
          id: string;
          alumno_id: string;
          semana_inicio: string;
          puntos: number;
          desglose: DesgloseSemanaJSON;
          cerrada_en: string;
        };
        Insert: {
          alumno_id: string;
          semana_inicio: string;
          puntos: number;
          desglose: DesgloseSemanaJSON;
        };
        Update: Partial<Database["public"]["Tables"]["ranking_semanas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ranking_semanas_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      torneos: {
        Row: {
          id: string;
          nombre: string;
          descripcion: string | null;
          metrica: TorneoMetrica;
          modalidad: TorneoModalidad;
          regla_publica: string | null;
          menor_es_mejor: boolean;
          unidad_manual: string | null;
          fecha_inicio: string;
          fecha_fin: string;
          // 0017_torneos_aceptacion.sql
          hora_inicio: string | null;
          hora_fin: string | null;
          puntos_en_juego: number;
          cerrado: boolean;
          creado_por: string | null;
          created_at: string;
          cerrado_en: string | null;
        };
        Insert: {
          nombre: string;
          descripcion?: string | null;
          metrica: TorneoMetrica;
          modalidad?: TorneoModalidad;
          regla_publica?: string | null;
          menor_es_mejor?: boolean;
          unidad_manual?: string | null;
          fecha_inicio: string;
          fecha_fin: string;
          hora_inicio?: string | null;
          hora_fin?: string | null;
          puntos_en_juego?: number;
          cerrado?: boolean;
          creado_por?: string | null;
          cerrado_en?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["torneos"]["Insert"]>;
        Relationships: [];
      };
      torneo_participantes: {
        Row: {
          torneo_id: string;
          alumno_id: string;
          resultado_manual: number | null;
          // 0017_torneos_aceptacion.sql
          estado: TorneoParticipanteEstado;
        };
        Insert: {
          torneo_id: string;
          alumno_id: string;
          resultado_manual?: number | null;
          estado?: TorneoParticipanteEstado;
        };
        Update: Partial<Database["public"]["Tables"]["torneo_participantes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "torneo_participantes_torneo_id_fkey";
            columns: ["torneo_id"];
            isOneToOne: false;
            referencedRelation: "torneos";
            referencedColumns: ["id"];
          },
        ];
      };
      torneo_resultados: {
        Row: {
          torneo_id: string;
          resultados: ResultadoTorneoJSON[];
          cerrada_en: string;
        };
        Insert: {
          torneo_id: string;
          resultados: ResultadoTorneoJSON[];
        };
        Update: Partial<Database["public"]["Tables"]["torneo_resultados"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "torneo_resultados_torneo_id_fkey";
            columns: ["torneo_id"];
            isOneToOne: false;
            referencedRelation: "torneos";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0043_impulso_vip.sql — configuración de progresión por asignación
      // (no por ejercicio de biblioteca: la misma máquina puede pedir
      // progresión distinta en dos rutinas).
      rutina_dia_ejercicio_progresion: {
        Row: {
          dia_ejercicio_id: string;
          apto_progresion: boolean;
          tipo_progresion: TipoProgresionImpulso;
          incremento_kg: number;
          requiere_autorizacion: boolean;
          rir_objetivo: number | null;
          creado_por: string | null;
          updated_at: string;
        };
        Insert: {
          dia_ejercicio_id: string;
          apto_progresion?: boolean;
          tipo_progresion?: TipoProgresionImpulso;
          incremento_kg?: number;
          requiere_autorizacion?: boolean;
          rir_objetivo?: number | null;
          creado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["rutina_dia_ejercicio_progresion"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "rutina_dia_ejercicio_progresion_dia_ejercicio_id_fkey";
            columns: ["dia_ejercicio_id"];
            isOneToOne: true;
            referencedRelation: "rutina_dia_ejercicios";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0043_impulso_vip.sql — una fila por sesion_ejercicio_id, congelada tras
      // el primer insert (ver generarYGuardarRecomendacion en
      // src/lib/impulso-vip/data.ts): la app nunca hace upsert sobre esta tabla.
      impulso_vip_recomendaciones: {
        Row: {
          id: string;
          sesion_ejercicio_id: string;
          dia_ejercicio_id: string;
          alumno_id: string;
          regla: ReglaImpulso;
          peso_sugerido_kg: number | null;
          reps_objetivo_min: number | null;
          reps_objetivo_max: number | null;
          es_peso_corporal: boolean;
          justificacion: string;
          basado_en_sesion_ejercicio_id: string | null;
          estado: EstadoRecomendacionImpulso;
          cumplimiento: CumplimientoImpulso | null;
          motor_version: string;
          decision_data: DecisionDataImpulso;
          created_at: string;
          resuelto_en: string | null;
        };
        Insert: {
          sesion_ejercicio_id: string;
          dia_ejercicio_id: string;
          alumno_id: string;
          regla: ReglaImpulso;
          peso_sugerido_kg?: number | null;
          reps_objetivo_min?: number | null;
          reps_objetivo_max?: number | null;
          es_peso_corporal?: boolean;
          justificacion: string;
          basado_en_sesion_ejercicio_id?: string | null;
          estado?: EstadoRecomendacionImpulso;
          motor_version?: string;
          decision_data?: DecisionDataImpulso;
        };
        Update: {
          estado?: EstadoRecomendacionImpulso;
          cumplimiento?: CumplimientoImpulso | null;
          resuelto_en?: string | null;
          peso_sugerido_kg?: number | null;
          reps_objetivo_min?: number | null;
          reps_objetivo_max?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "impulso_vip_recomendaciones_sesion_ejercicio_id_fkey";
            columns: ["sesion_ejercicio_id"];
            isOneToOne: true;
            referencedRelation: "sesion_ejercicios";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0043_impulso_vip.sql — dispara la Regla E. Zona/intensidad/momento son
      // columnas (no jsonb) para poder filtrar y agregar en el panel del
      // entrenador sin parsear nada.
      impulso_vip_alertas: {
        Row: {
          id: string;
          alumno_id: string;
          dia_ejercicio_id: string;
          tipo: TipoAlertaImpulso;
          zona: string | null;
          intensidad: number | null;
          momento: MomentoAlertaImpulso | null;
          detuvo_ejercicio: boolean | null;
          detalle: string | null;
          sesion_ejercicio_id: string | null;
          estado: EstadoAlertaImpulso;
          creado_en: string;
          resuelto_en: string | null;
          resuelto_por: string | null;
        };
        Insert: {
          alumno_id: string;
          dia_ejercicio_id: string;
          tipo: TipoAlertaImpulso;
          zona?: string | null;
          intensidad?: number | null;
          momento?: MomentoAlertaImpulso | null;
          detuvo_ejercicio?: boolean | null;
          detalle?: string | null;
          sesion_ejercicio_id?: string | null;
        };
        Update: {
          estado?: EstadoAlertaImpulso;
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "impulso_vip_alertas_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0048_reportes_fotos_ejercicios.sql — aviso del alumno cuando la foto
      // de referencia no corresponde al movimiento indicado.
      reportes_fotos_ejercicios: {
        Row: {
          id: string;
          alumno_id: string;
          ejercicio_id: string | null;
          sesion_ejercicio_id: string | null;
          nombre_ejercicio: string;
          foto_url_reportada: string | null;
          estado: EstadoReporteFotoEjercicio;
          creado_en: string;
          resuelto_en: string | null;
          resuelto_por: string | null;
        };
        Insert: {
          alumno_id: string;
          ejercicio_id?: string | null;
          sesion_ejercicio_id?: string | null;
          nombre_ejercicio: string;
          foto_url_reportada?: string | null;
          estado?: EstadoReporteFotoEjercicio;
        };
        Update: {
          estado?: EstadoReporteFotoEjercicio;
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [];
      };
      push_suscripciones: {
        Row: {
          id: string;
          alumno_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          creado_en: string;
        };
        Insert: {
          alumno_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: {
          alumno_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_suscripciones_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      registro_cambios: {
        Row: {
          id: string;
          titulo: string;
          resumen: string;
          categoria: "arreglo" | "mejora" | "funcion_nueva";
          creado_en: string;
        };
        Insert: {
          titulo: string;
          resumen: string;
          categoria?: "arreglo" | "mejora" | "funcion_nueva";
        };
        Update: {
          titulo?: string;
          resumen?: string;
          categoria?: "arreglo" | "mejora" | "funcion_nueva";
        };
        Relationships: [];
      };
      // 0046_auditoria_revisiones.sql
      auditoria_revisiones: {
        Row: {
          id: string;
          tipo: "sesion_duracion_imposible" | "puntos_entrenamiento_huerfanos";
          referencia_id: string;
          alumno_id: string;
          estado: "descartado" | "penalizado";
          puntos_ajustados: number | null;
          nota: string | null;
          revisor_id: string;
          creado_en: string;
        };
        Insert: {
          tipo: "sesion_duracion_imposible" | "puntos_entrenamiento_huerfanos";
          referencia_id: string;
          alumno_id: string;
          estado: "descartado" | "penalizado";
          puntos_ajustados?: number | null;
          nota?: string | null;
          revisor_id: string;
        };
        Update: {
          estado?: "descartado" | "penalizado";
          puntos_ajustados?: number | null;
          nota?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auditoria_revisiones_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auditoria_revisiones_revisor_id_fkey";
            columns: ["revisor_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0050_alumno_accesos.sql
      alumno_accesos: {
        Row: {
          id: string;
          alumno_id: string;
          ingreso_en: string;
        };
        Insert: {
          alumno_id: string;
          ingreso_en?: string;
        };
        Update: {
          alumno_id?: string;
          ingreso_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alumno_accesos_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "alumno_perfil";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
