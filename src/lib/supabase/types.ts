// Tipado manual del esquema (supabase/migrations/0001_init.sql).
// Cuando el proyecto Supabase real exista, se puede regenerar con:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Por ahora se mantiene a mano para no depender de un proyecto ya creado.

export type Rol = "alumno" | "entrenador" | "admin";
export type EstadoSesion = "en_progreso" | "completada" | "finalizada_incompleta" | "abandonada";
// "otro" viene de 0027: documentos que no son ni rutina ni plan de comidas.
export type TipoDocumento = "rutina" | "alimentacion" | "otro";
export type CategoriaFoto = "frontal" | "lateral" | "espalda" | "otra";
export type TorneoMetrica = "peso_baja" | "peso_sube" | "asistencia" | "manual";
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
/** Forma de cada fila del snapshot de resultados de un torneo (ver ResultadoTorneo en lib/torneos/puntos.ts). */
export type ResultadoTorneoJSON = {
  alumnoId: string;
  nombre: string;
  valor: number;
  puesto: number;
  puntosDelta: number;
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
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["configuracion_gimnasio"]["Insert"]>;
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
        };
        Insert: { sesion_id: string; dia_ejercicio_id: string; completado?: boolean };
        Update: { completado?: boolean; completado_en?: string | null; nota?: string | null };
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
        Relationships: [];
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
          // 0031_tempo_ejercicios.sql — el tempo es del movimiento, no de la
          // rutina: se calcula una vez por ejercicio y lo reutilizan todas.
          tempo: string | null;
          tempo_nota: string | null;
          tempo_origen: "ia" | "entrenador" | null;
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
          tempo?: string | null;
          tempo_nota?: string | null;
          tempo_origen?: "ia" | "entrenador" | null;
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
        };
        Insert: {
          registro_diario_id: string;
          tipo_comida: string;
          omitida?: boolean;
          observacion?: string | null;
        };
        Update: { omitida?: boolean; observacion?: string | null };
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
