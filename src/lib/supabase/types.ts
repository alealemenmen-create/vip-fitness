// Tipado manual del esquema (supabase/migrations/0001_init.sql).
// Cuando el proyecto Supabase real exista, se puede regenerar con:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// Por ahora se mantiene a mano para no depender de un proyecto ya creado.

export type Rol = "alumno" | "entrenador" | "admin";
// 0032: sexo declarado en el registro, editable después desde "Mi perfil".
export type Sexo = "femenino" | "masculino" | "otro";
export type CodigoPlanEntrenamiento = "access" | "select" | "pro" | "elite";
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
// 0079: momentos de Impulso VIP dentro de una serie concreta.
export type TipoIntervencionImpulso =
  | "cierre_controlado"
  | "repeticion_objetivo"
  | "tempo_controlado"
  | "pausa_isometrica"
  | "serie_descarga"
  | "drop_set"
  | "rest_pause"
  | "fallo_controlado";
export type OrigenIntervencionImpulso = "metodo_ale" | "preparada_por_ale" | "personal_ale";
export type EstadoIntervencionImpulso = "preparada" | "mostrada" | "resuelta" | "cancelada";
export type ResultadoIntervencionImpulso =
  | "lograda"
  | "parcial"
  | "no_lograda"
  | "omitida"
  | "omitida_molestia";
export type VerificacionIntervencionImpulso = "datos" | "declarada" | "entrenador";
export type EstadoSolicitudAsistenciaImpulso = "pendiente" | "voy" | "atendida" | "no_disponible" | "vencida";
export type EstadoReporteFotoEjercicio = "pendiente" | "resuelto";
export type EstadoReporteBug = "pendiente" | "resuelto";
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
        Row: {
          id: string;
          nombre: string;
          rol: Rol;
          created_at: string;
        };
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
          plan_entrenamiento: CodigoPlanEntrenamiento | null;
          sesiones_mensuales: number | null;
          dias_entrenamiento_semana: number | null;
          plan_entrenamiento_pausado: boolean;
          // 0087_temporizador_descanso_por_alumno.sql
          temporizador_descanso: boolean;
          // 0091_temporizador_descanso_por_alumno_penalizacion.sql — true
          // solo si fue el ALUMNO quien lo apagó (no el entrenador).
          temporizador_descanso_desactivado_por_alumno: boolean;
          // 0092_segundos_descanso_preferido.sql — si no es null, reemplaza
          // el descanso_segundos de CADA ejercicio (ver alumno/entrenar/data.ts).
          segundos_descanso_preferido: number | null;
          // 0090_acceso_bloqueado_alumno.sql — corta el acceso a TODA la
          // app (ej. no pagó), distinto de plan_entrenamiento_pausado.
          acceso_bloqueado: boolean;
          acceso_bloqueado_motivo: string | null;
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
          plan_entrenamiento?: CodigoPlanEntrenamiento | null;
          sesiones_mensuales?: number | null;
          dias_entrenamiento_semana?: number | null;
          plan_entrenamiento_pausado?: boolean;
          temporizador_descanso?: boolean;
          temporizador_descanso_desactivado_por_alumno?: boolean;
          segundos_descanso_preferido?: number | null;
          acceso_bloqueado?: boolean;
          acceso_bloqueado_motivo?: string | null;
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
          plan_entrenamiento?: CodigoPlanEntrenamiento | null;
          sesiones_mensuales?: number | null;
          dias_entrenamiento_semana?: number | null;
          acceso_bloqueado?: boolean;
          acceso_bloqueado_motivo?: string | null;
          plan_entrenamiento_pausado?: boolean;
          temporizador_descanso?: boolean;
          temporizador_descanso_desactivado_por_alumno?: boolean;
          segundos_descanso_preferido?: number | null;
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
          // 0065_saldo_y_consumo_ia.sql suma las tres últimas: hasta entonces
          // la revisión de rutinas, la lectura de PDF y los retos gastaban sin
          // quedar registrados en ningún lado.
          herramienta:
            | "atencion"
            | "nutricion"
            | "entrenamiento"
            | "progreso"
            | "noticia"
            | "alumno"
            | "eliminar_datos"
            | "revision_rutina"
            | "extraccion_documento"
            | "reto";
          modelo: string;
          tokens_entrada: number;
          tokens_salida: number;
          costo_usd: number;
          created_at: string;
        };
        Insert: {
          usuario_id: string;
          // 0065_saldo_y_consumo_ia.sql suma las tres últimas: hasta entonces
          // la revisión de rutinas, la lectura de PDF y los retos gastaban sin
          // quedar registrados en ningún lado.
          herramienta:
            | "atencion"
            | "nutricion"
            | "entrenamiento"
            | "progreso"
            | "noticia"
            | "alumno"
            | "eliminar_datos"
            | "revision_rutina"
            | "extraccion_documento"
            | "reto";
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
          // 0089_archivar_rutinas.sql — oculta del listado de "Rutinas hechas"
          // sin borrar nada; no afecta sesiones ni puntos.
          archivada: boolean;
        };
        Insert: {
          alumno_id: string;
          nombre: string;
          activa?: boolean;
          version?: number;
          created_by?: string | null;
          archivada?: boolean;
        };
        Update: { nombre?: string; activa?: boolean; version?: number; archivada?: boolean };
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
          // 0073_tecnica_por_serie.sql — números de serie (base 1) donde se
          // aplica la técnica. `null` = todas las series (comportamiento
          // histórico, y lo que tienen todas las filas anteriores a la
          // migración). Siempre `null` en técnicas encadenadas.
          tecnica_series: number[] | null;
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
          tecnica_series?: number[] | null;
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
          // 0077 — no null mientras se corrige un registro ya cerrado.
          corrigiendo_desde: string | null;
          // 0078 — cuándo se corrigió por primera vez. A diferencia de
          // corrigiendo_desde no se limpia: es lo que hace que una sesión
          // abandonada vuelva a contar como historial para Impulso VIP.
          corregida_en: string | null;
        };
        Insert: {
          alumno_id: string;
          rutina_id?: string | null;
          dia_id?: string | null;
          fecha?: string;
          numero_calendario?: number | null;
          estado?: EstadoSesion;
          comentario?: string | null;
          rutina_iniciada_en?: string | null;
          corrigiendo_desde?: string | null;
          corregida_en?: string | null;
        };
        Update: {
          hora_fin?: string | null;
          estado?: EstadoSesion;
          comentario?: string | null;
          rutina_iniciada_en?: string | null;
          corrigiendo_desde?: string | null;
          corregida_en?: string | null;
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
      // 0104_personalizacion_sesion_v2.sql — diferencias de una sesión sin
      // alterar la rutina publicada del entrenador.
      sesion_ejercicio_personalizaciones: {
        Row: {
          sesion_ejercicio_id: string;
          alumno_id: string;
          ejercicio_sustituto_id: string | null;
          orden_ejecucion: number | null;
          motivo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          sesion_ejercicio_id: string;
          alumno_id: string;
          ejercicio_sustituto_id?: string | null;
          orden_ejecucion?: number | null;
          motivo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sesion_ejercicio_personalizaciones"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sesion_ejercicio_personalizaciones_sesion_ejercicio_id_fkey";
            columns: ["sesion_ejercicio_id"];
            isOneToOne: true;
            referencedRelation: "sesion_ejercicios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sesion_ejercicio_personalizaciones_ejercicio_sustituto_id_fkey";
            columns: ["ejercicio_sustituto_id"];
            isOneToOne: false;
            referencedRelation: "ejercicios";
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
          // 0080_trazabilidad_serie_impulso.sql
          realizada_en: string | null;
          rir_estimado: number | null;
          calidad_tecnica: "limpia" | "forzada" | "rota" | null;
          origen_registro: "directo" | "confirmado_sin_datos" | "corregido";
          updated_at: string;
        };
        Insert: {
          sesion_ejercicio_id: string;
          numero_serie: number;
          peso_kg?: number | null;
          es_peso_corporal?: boolean;
          reps_realizadas?: number | null;
          nota?: string | null;
          realizada?: boolean;
          realizada_en?: string | null;
          rir_estimado?: number | null;
          calidad_tecnica?: "limpia" | "forzada" | "rota" | null;
          origen_registro?: "directo" | "confirmado_sin_datos" | "corregido";
          updated_at?: string;
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
          // 0099_ejercicio_calidad_ficha.sql — nulas cuando calidad_ficha es
          // 'requiere_clasificacion' (alta rápida sin clasificar todavía).
          grupo_muscular:
            | "pecho"
            | "espalda"
            | "piernas"
            | "hombros"
            | "brazos"
            | "core"
            | "cardio"
            | null;
          grupos_secundarios: string[];
          categoria:
            | "empuje"
            | "traccion"
            | "pierna"
            | "core"
            | "cardio"
            | "aislamiento"
            | "full_body"
            | null;
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
            | "otro"
            | null;
          // 0099_ejercicio_calidad_ficha.sql
          calidad_ficha: "completa" | "requiere_clasificacion";
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
          // 0102_ejercicio_video_cloudflare_dimensiones.sql — para recortar
          // el reproductor y cubrir el cuadro 16:9 sin franjas.
          video_cloudflare_ancho: number | null;
          video_cloudflare_alto: number | null;
          // 0098_ejercicio_video_cloudflare_uid_anterior.sql — UID que se
          // reemplazó, guardado hasta confirmar que el nuevo terminó de
          // procesar; recién ahí se borra de Cloudflare.
          video_cloudflare_uid_anterior: string | null;
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
          // 0095_ejercicio_foto_hash.sql — hash de contenido de la
          // miniatura procesada, para detectar duplicados exactos.
          foto_hash: string | null;
          // 0051_generador_rutinas.sql — clasificación biomecánica
          // estructurada, vacía para casi toda la biblioteca todavía. Sin
          // restricción `check` en la base: es texto libre validado en la
          // Server Action (ver PATRONES_MOVIMIENTO_VALIDOS).
          patron_movimiento: string | null;
          // 0082_elegibilidad_tecnicas_impulso.sql
          impulso_intensidad_maxima: "ninguna" | "baja" | "media" | "alta";
          impulso_tecnicas_permitidas: Array<
            "tempo_controlado" | "pausa_isometrica" | "serie_descarga" | "drop_set" | "rest_pause" | "fallo_controlado"
          >;
          impulso_requiere_supervision: boolean;
          impulso_perfil_revisado: boolean;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          nombre: string;
          aliases?: string[];
          grupo_muscular?:
            | "pecho"
            | "espalda"
            | "piernas"
            | "hombros"
            | "brazos"
            | "core"
            | "cardio"
            | null;
          grupos_secundarios?: string[];
          categoria?:
            | "empuje"
            | "traccion"
            | "pierna"
            | "core"
            | "cardio"
            | "aislamiento"
            | "full_body"
            | null;
          equipo?:
            | "barra"
            | "mancuerna"
            | "polea"
            | "maquina"
            | "smith"
            | "peso_corporal"
            | "kettlebell"
            | "banda"
            | "banco"
            | "otro"
            | null;
          calidad_ficha?: "completa" | "requiere_clasificacion";
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
          video_cloudflare_ancho?: number | null;
          video_cloudflare_alto?: number | null;
          video_cloudflare_uid_anterior?: string | null;
          tempo?: string | null;
          tempo_nota?: string | null;
          tempo_origen?: "ia" | "entrenador" | null;
          foto_miniatura_url?: string | null;
          foto_panorama_x?: number;
          foto_panorama_y?: number;
          foto_cuadrada_x?: number;
          foto_cuadrada_y?: number;
          impulso_intensidad_maxima?: "ninguna" | "baja" | "media" | "alta";
          impulso_tecnicas_permitidas?: Array<
            "tempo_controlado" | "pausa_isometrica" | "serie_descarga" | "drop_set" | "rest_pause" | "fallo_controlado"
          >;
          impulso_requiere_supervision?: boolean;
          impulso_perfil_revisado?: boolean;
          foto_completa_url?: string | null;
          foto_hash?: string | null;
          patron_movimiento?: string | null;
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
      // 0105_biblioteca_nutricion_v2.sql
      alimentos_favoritos: {
        Row: { alumno_id: string; alimento_id: string; created_at: string };
        Insert: { alumno_id: string; alimento_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      recetas_alumno: {
        Row: { id: string; alumno_id: string; nombre: string; porciones: number; created_at: string; updated_at: string };
        Insert: { id?: string; alumno_id: string; nombre: string; porciones?: number; created_at?: string; updated_at?: string };
        Update: { nombre?: string; porciones?: number; updated_at?: string };
        Relationships: [];
      };
      receta_ingredientes: {
        Row: { receta_id: string; alimento_id: string; cantidad: number; orden: number };
        Insert: { receta_id: string; alimento_id: string; cantidad: number; orden?: number };
        Update: { cantidad?: number; orden?: number };
        Relationships: [];
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
      comunidad_publicaciones: {
        Row: { id: string; alumno_id: string; foto_progreso_id: string | null; texto: string; estado: "publicada" | "oculta" | "eliminada"; created_at: string; updated_at: string };
        Insert: { id?: string; alumno_id: string; foto_progreso_id?: string | null; texto?: string; estado?: "publicada" | "oculta" | "eliminada"; created_at?: string; updated_at?: string };
        Update: { texto?: string; estado?: "publicada" | "oculta" | "eliminada"; updated_at?: string };
        Relationships: [];
      };
      comunidad_reacciones: {
        Row: { publicacion_id: string; alumno_id: string; tipo: "aplauso"; created_at: string };
        Insert: { publicacion_id: string; alumno_id: string; tipo?: "aplauso"; created_at?: string };
        Update: never;
        Relationships: [];
      };
      comunidad_comentarios: {
        Row: { id: string; publicacion_id: string; alumno_id: string; texto: string; estado: "publicado" | "oculto" | "eliminado"; created_at: string };
        Insert: { id?: string; publicacion_id: string; alumno_id: string; texto: string; estado?: "publicado" | "oculto" | "eliminado"; created_at?: string };
        Update: { estado?: "publicado" | "oculto" | "eliminado" };
        Relationships: [];
      };
      comunidad_reportes: {
        Row: { id: string; publicacion_id: string; reportado_por: string; motivo: string; estado: "pendiente" | "revisado" | "descartado"; created_at: string };
        Insert: { id?: string; publicacion_id: string; reportado_por: string; motivo: string; estado?: "pendiente" | "revisado" | "descartado"; created_at?: string };
        Update: { estado?: "pendiente" | "revisado" | "descartado" };
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
      // 0069_torneo_apuestas.sql — el público de la carrera de caballos:
      // apuesta el que NO compite. Una sola apuesta por alumno y torneo.
      torneo_apuestas: {
        Row: {
          id: string;
          torneo_id: string;
          alumno_id: string;
          por_alumno_id: string;
          puntos: number;
          created_at: string;
          devuelto: number | null;
          resuelta_en: string | null;
        };
        Insert: {
          torneo_id: string;
          alumno_id: string;
          por_alumno_id: string;
          puntos: number;
          devuelto?: number | null;
          resuelta_en?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["torneo_apuestas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "torneo_apuestas_torneo_id_fkey";
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
      // 0079_impulso_vip_en_vivo.sql — una instruccion puntual para una
      // serie. No reemplaza la recomendacion general del ejercicio.
      impulso_vip_intervenciones: {
        Row: {
          id: string;
          sesion_ejercicio_id: string;
          alumno_id: string;
          serie_objetivo: number;
          tipo: TipoIntervencionImpulso;
          origen: OrigenIntervencionImpulso;
          firma: string;
          instruccion: string;
          motivo: string;
          prescripcion: Record<string, unknown>;
          estado: EstadoIntervencionImpulso;
          resultado: ResultadoIntervencionImpulso | null;
          resultado_data: Record<string, unknown>;
          verificacion: VerificacionIntervencionImpulso | null;
          motor_version: string;
          decision_data: Record<string, unknown>;
          mostrada_en: string | null;
          resuelta_en: string | null;
          created_at: string;
        };
        Insert: {
          sesion_ejercicio_id: string;
          alumno_id: string;
          serie_objetivo: number;
          tipo: TipoIntervencionImpulso;
          origen?: OrigenIntervencionImpulso;
          firma?: string;
          instruccion: string;
          motivo: string;
          prescripcion?: Record<string, unknown>;
          estado?: EstadoIntervencionImpulso;
          resultado?: ResultadoIntervencionImpulso | null;
          resultado_data?: Record<string, unknown>;
          verificacion?: VerificacionIntervencionImpulso | null;
          motor_version?: string;
          decision_data?: Record<string, unknown>;
          mostrada_en?: string | null;
          resuelta_en?: string | null;
          created_at?: string;
        };
        Update: {
          estado?: EstadoIntervencionImpulso;
          tipo?: TipoIntervencionImpulso;
          origen?: OrigenIntervencionImpulso;
          firma?: string;
          instruccion?: string;
          motivo?: string;
          prescripcion?: Record<string, unknown>;
          motor_version?: string;
          decision_data?: Record<string, unknown>;
          resultado?: ResultadoIntervencionImpulso | null;
          resultado_data?: Record<string, unknown>;
          verificacion?: VerificacionIntervencionImpulso | null;
          mostrada_en?: string | null;
          resuelta_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "impulso_vip_intervenciones_sesion_ejercicio_id_fkey";
            columns: ["sesion_ejercicio_id"];
            isOneToOne: false;
            referencedRelation: "sesion_ejercicios";
            referencedColumns: ["id"];
          },
        ];
      };
      // 0086_avisos_push_impulso_entrenador.sql
      impulso_vip_avisos_entrenador: {
        Row: {
          intervencion_id: string;
          alumno_id: string;
          estado: "pendiente" | "aprobada" | "descartada" | "automatica";
          enviado_en: string;
          vence_en: string;
          respondida_en: string | null;
          respondida_por: string | null;
        };
        Insert: {
          intervencion_id: string;
          alumno_id: string;
          estado?: "pendiente" | "aprobada" | "descartada" | "automatica";
          enviado_en?: string;
          vence_en?: string;
          respondida_en?: string | null;
          respondida_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["impulso_vip_avisos_entrenador"]["Insert"]>;
        Relationships: [];
      };
      perfiles_entrenamiento: {
        Row: {
          alumno_id: string;
          objetivo_principal: string | null;
          experiencia: "principiante" | "intermedio" | "avanzado" | null;
          molestias: string | null;
          lesiones_diagnosticadas: string | null;
          condiciones_medicas: string | null;
          autorizacion_medica: boolean;
          requiere_revision: boolean;
          revisado_en: string | null;
          version: number;
          updated_at: string;
        };
        Insert: {
          alumno_id: string;
          objetivo_principal?: string | null;
          experiencia?: "principiante" | "intermedio" | "avanzado" | null;
          molestias?: string | null;
          lesiones_diagnosticadas?: string | null;
          condiciones_medicas?: string | null;
          autorizacion_medica?: boolean;
          requiere_revision?: boolean;
          revisado_en?: string | null;
          version?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["perfiles_entrenamiento"]["Insert"]>;
        Relationships: [];
      };
      // 0081_asistencia_ale_en_vivo.sql — solicitud contextual y temporal.
      impulso_vip_memoria_tecnicas: {
        Row: {
          id: string;
          alumno_id: string;
          ejercicio_id: string;
          tecnica: "drop_set" | "rest_pause" | "fallo_controlado";
          intentos: number;
          logradas: number;
          verificadas: number;
          parciales: number;
          fallidas: number;
          omitidas: number;
          molestias: number;
          racha: number;
          confianza: "en_prueba" | "confiable" | "retroceder";
          ultimo_resultado: ResultadoIntervencionImpulso | null;
          ultima_intervencion_id: string | null;
          ultima_intervencion_en: string | null;
          updated_at: string;
        };
        Insert: {
          alumno_id: string;
          ejercicio_id: string;
          tecnica: "drop_set" | "rest_pause" | "fallo_controlado";
          intentos?: number;
          logradas?: number;
          verificadas?: number;
          parciales?: number;
          fallidas?: number;
          omitidas?: number;
          molestias?: number;
          racha?: number;
          confianza?: "en_prueba" | "confiable" | "retroceder";
          ultimo_resultado?: ResultadoIntervencionImpulso | null;
          ultima_intervencion_id?: string | null;
          ultima_intervencion_en?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["impulso_vip_memoria_tecnicas"]["Insert"]>;
        Relationships: [];
      };
      impulso_vip_indicaciones_programadas: {
        Row: {
          id: string;
          alumno_id: string;
          dia_ejercicio_id: string;
          serie_objetivo: number;
          tipo: TipoIntervencionImpulso;
          instruccion: string;
          prescripcion: Record<string, unknown>;
          estado: "pendiente" | "entregada" | "cancelada";
          creada_por: string;
          creada_en: string;
          entregada_en: string | null;
          intervencion_id: string | null;
        };
        Insert: {
          alumno_id: string;
          dia_ejercicio_id: string;
          serie_objetivo: number;
          tipo: TipoIntervencionImpulso;
          instruccion: string;
          prescripcion?: Record<string, unknown>;
          estado?: "pendiente" | "entregada" | "cancelada";
          creada_por: string;
          creada_en?: string;
          entregada_en?: string | null;
          intervencion_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["impulso_vip_indicaciones_programadas"]["Insert"]>;
        Relationships: [];
      };
      impulso_vip_solicitudes_asistencia: {
        Row: {
          id: string;
          intervencion_id: string;
          alumno_id: string;
          sesion_ejercicio_id: string;
          estado: EstadoSolicitudAsistenciaImpulso;
          mensaje_alumno: string | null;
          respuesta_entrenador: string | null;
          solicitada_en: string;
          vence_en: string;
          respondida_en: string | null;
          respondida_por: string | null;
        };
        Insert: {
          intervencion_id: string;
          alumno_id: string;
          sesion_ejercicio_id: string;
          estado?: EstadoSolicitudAsistenciaImpulso;
          mensaje_alumno?: string | null;
          respuesta_entrenador?: string | null;
          solicitada_en?: string;
          vence_en?: string;
          respondida_en?: string | null;
          respondida_por?: string | null;
        };
        Update: {
          estado?: EstadoSolicitudAsistenciaImpulso;
          respuesta_entrenador?: string | null;
          respondida_en?: string | null;
          respondida_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "impulso_vip_solicitudes_asistencia_intervencion_id_fkey";
            columns: ["intervencion_id"];
            isOneToOne: true;
            referencedRelation: "impulso_vip_intervenciones";
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
          dia_ejercicio_id: string | null;
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
          dia_ejercicio_id?: string | null;
          nombre_ejercicio: string;
          foto_url_reportada?: string | null;
          estado?: EstadoReporteFotoEjercicio;
        };
        Update: {
          ejercicio_id?: string | null;
          estado?: EstadoReporteFotoEjercicio;
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [];
      };
      // 0072_reportes_bugs.sql — botón flotante de reporte de fallas: captura
      // de pantalla + descripción, directo al panel del entrenador.
      reportes_bugs: {
        Row: {
          id: string;
          alumno_id: string;
          ruta: string;
          descripcion: string;
          captura_path: string | null;
          dispositivo: string | null;
          estado: EstadoReporteBug;
          creado_en: string;
          resuelto_en: string | null;
          resuelto_por: string | null;
        };
        Insert: {
          alumno_id: string;
          ruta: string;
          descripcion: string;
          captura_path?: string | null;
          dispositivo?: string | null;
          estado?: EstadoReporteBug;
        };
        Update: {
          estado?: EstadoReporteBug;
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [];
      };
      // 0076_solicitudes_borrado_sesion.sql — borrar un registro destruye
      // historial, así que el alumno pide y el entrenador resuelve. La fila
      // sobrevive al borrado (`sesion_id` queda en null) y guarda una foto de
      // qué era esa sesión: es la única constancia que queda.
      solicitudes_borrado_sesion: {
        Row: {
          id: string;
          alumno_id: string;
          sesion_id: string | null;
          dia_nombre: string;
          fecha_sesion: string | null;
          numero_calendario: number | null;
          motivo: string;
          estado: "pendiente" | "borrada" | "rechazada";
          creado_en: string;
          resuelto_en: string | null;
          resuelto_por: string | null;
        };
        Insert: {
          alumno_id: string;
          sesion_id: string;
          dia_nombre: string;
          fecha_sesion?: string | null;
          numero_calendario?: number | null;
          motivo: string;
          estado?: "pendiente" | "borrada" | "rechazada";
        };
        Update: {
          estado?: "pendiente" | "borrada" | "rechazada";
          resuelto_en?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [];
      };
      // 0093_ejercicio_fusiones_historial.sql — historial de fusiones de
      // ejercicios duplicados, con lo necesario para deshacer con precisión
      // (las filas exactas de rutina_dia_ejercicios que se reasignaron).
      ejercicio_fusiones: {
        Row: {
          id: string;
          original_id: string;
          original_nombre: string;
          duplicado_id: string | null;
          duplicado_nombre: string;
          aliases_antes: string[];
          rutina_dia_ejercicios_ids: string[];
          fusionado_por: string;
          fusionado_en: string;
          deshecho_en: string | null;
          deshecho_por: string | null;
        };
        Insert: {
          original_id: string;
          original_nombre: string;
          duplicado_id?: string | null;
          duplicado_nombre: string;
          aliases_antes?: string[];
          rutina_dia_ejercicios_ids?: string[];
          fusionado_por: string;
        };
        Update: {
          deshecho_en?: string | null;
          deshecho_por?: string | null;
        };
        Relationships: [];
      };
      // 0094_ejercicio_foto_version_anterior.sql — una sola versión anterior
      // restaurable por ejercicio, para deshacer un reemplazo de foto
      // equivocado antes de que se borre el archivo de Storage.
      ejercicio_foto_version_anterior: {
        Row: {
          ejercicio_id: string;
          foto_miniatura_url: string;
          foto_completa_url: string;
          foto_panorama_x: number;
          foto_panorama_y: number;
          foto_cuadrada_x: number;
          foto_cuadrada_y: number;
          reemplazada_por: string;
          reemplazada_en: string;
        };
        Insert: {
          ejercicio_id: string;
          foto_miniatura_url: string;
          foto_completa_url: string;
          foto_panorama_x?: number;
          foto_panorama_y?: number;
          foto_cuadrada_x?: number;
          foto_cuadrada_y?: number;
          reemplazada_por: string;
        };
        Update: {
          foto_miniatura_url?: string;
          foto_completa_url?: string;
          foto_panorama_x?: number;
          foto_panorama_y?: number;
          foto_cuadrada_x?: number;
          foto_cuadrada_y?: number;
          reemplazada_por?: string;
        };
        Relationships: [];
      };
      // 0100_ejercicio_ingestas.sql — Fase 2 del instructivo de galería
      // multimedia: sesiones de carga por lote que sobreviven a un refresh.
      ejercicio_ingestas: {
        Row: {
          id: string;
          entrenador_id: string;
          origen: "carga" | "camara" | "modo_gimnasio" | "pendiente" | "alta";
          estado: "borrador" | "cargando" | "requiere_revision" | "aplicando" | "completada" | "parcial" | "cancelada";
          total_archivos: number;
          archivos_listos: number;
          archivos_error: number;
          creado_en: string;
          actualizado_en: string;
          completado_en: string | null;
        };
        Insert: {
          entrenador_id: string;
          origen?: "carga" | "camara" | "modo_gimnasio" | "pendiente" | "alta";
          estado?: "borrador" | "cargando" | "requiere_revision" | "aplicando" | "completada" | "parcial" | "cancelada";
          total_archivos?: number;
          archivos_listos?: number;
          archivos_error?: number;
          completado_en?: string | null;
        };
        Update: {
          estado?: "borrador" | "cargando" | "requiere_revision" | "aplicando" | "completada" | "parcial" | "cancelada";
          total_archivos?: number;
          archivos_listos?: number;
          archivos_error?: number;
          actualizado_en?: string;
          completado_en?: string | null;
        };
        Relationships: [];
      };
      ejercicio_ingesta_items: {
        Row: {
          id: string;
          ingesta_id: string;
          clave_idempotente: string;
          nombre_archivo: string;
          mime: string | null;
          tamano_bytes: number | null;
          tipo: "imagen" | "video";
          ejercicio_id: string | null;
          nombre_candidato: string | null;
          confianza: "alta" | "revisar" | "sin_match" | null;
          estado: "local" | "subiendo" | "procesando" | "listo" | "error" | "aplicado";
          error_detalle: string | null;
          intentos: number;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          ingesta_id: string;
          clave_idempotente: string;
          nombre_archivo: string;
          mime?: string | null;
          tamano_bytes?: number | null;
          tipo: "imagen" | "video";
          ejercicio_id?: string | null;
          nombre_candidato?: string | null;
          confianza?: "alta" | "revisar" | "sin_match" | null;
          estado?: "local" | "subiendo" | "procesando" | "listo" | "error" | "aplicado";
          error_detalle?: string | null;
          intentos?: number;
        };
        Update: {
          ejercicio_id?: string | null;
          estado?: "local" | "subiendo" | "procesando" | "listo" | "error" | "aplicado";
          error_detalle?: string | null;
          intentos?: number;
          actualizado_en?: string;
        };
        Relationships: [];
      };
      // 0101_ejercicio_multimedia.sql — Fase 3 del instructivo de galería
      // multimedia: historial y ángulos extra, aditiva a las columnas de
      // siempre en `ejercicios` (esas siguen siendo la fuente de verdad
      // para el alumno).
      ejercicio_multimedia: {
        Row: {
          id: string;
          ejercicio_id: string;
          tipo: "imagen" | "video";
          rol: "portada" | "galeria" | "demostracion" | "error_comun";
          es_principal: boolean;
          estado: "procesando" | "listo" | "error" | "archivado";
          storage_path_miniatura: string | null;
          storage_path_completa: string | null;
          video_cloudflare_uid: string | null;
          ancho: number | null;
          alto: number | null;
          duracion_seg: number | null;
          tamano_bytes: number | null;
          hash_sha256: string | null;
          orden: number;
          version_reemplazada_id: string | null;
          creado_por: string | null;
          creado_en: string;
          archivado_en: string | null;
        };
        Insert: {
          ejercicio_id: string;
          tipo: "imagen" | "video";
          rol?: "portada" | "galeria" | "demostracion" | "error_comun";
          es_principal?: boolean;
          estado?: "procesando" | "listo" | "error" | "archivado";
          storage_path_miniatura?: string | null;
          storage_path_completa?: string | null;
          video_cloudflare_uid?: string | null;
          ancho?: number | null;
          alto?: number | null;
          duracion_seg?: number | null;
          tamano_bytes?: number | null;
          hash_sha256?: string | null;
          orden?: number;
          version_reemplazada_id?: string | null;
          creado_por?: string | null;
          archivado_en?: string | null;
        };
        Update: {
          rol?: "portada" | "galeria" | "demostracion" | "error_comun";
          es_principal?: boolean;
          estado?: "procesando" | "listo" | "error" | "archivado";
          version_reemplazada_id?: string | null;
          archivado_en?: string | null;
        };
        Relationships: [];
      };
      // 0097_notificaciones_entrenador.sql — bandeja + push del entrenador.
      notificaciones_entrenador: {
        Row: {
          id: string;
          tipo: string;
          alumno_id: string | null;
          titulo: string;
          cuerpo: string;
          prioridad: string;
          ruta: string | null;
          clave_dedup: string | null;
          leida_en: string | null;
          creado_en: string;
        };
        Insert: {
          tipo: string;
          alumno_id?: string | null;
          titulo: string;
          cuerpo: string;
          prioridad?: string;
          ruta?: string | null;
          clave_dedup?: string | null;
        };
        Update: {
          leida_en?: string | null;
        };
        Relationships: [];
      };
      // 0096_resenas_app.sql — estrellas + sugerencia libre desde el perfil
      // del alumno.
      resenas_app: {
        Row: {
          id: string;
          alumno_id: string;
          estrellas: number;
          sugerencia: string | null;
          ruta: string | null;
          creado_en: string;
        };
        Insert: {
          alumno_id: string;
          estrellas: number;
          sugerencia?: string | null;
          ruta?: string | null;
        };
        Update: {
          estrellas?: number;
          sugerencia?: string | null;
          ruta?: string | null;
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
          id?: string;
          titulo: string;
          resumen: string;
          categoria?: "arreglo" | "mejora" | "funcion_nueva";
          creado_en?: string;
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
          // 0066_auditoria_tipos_hallazgo.sql amplió el check.
          tipo:
            | "sesion_duracion_imposible"
            | "puntos_entrenamiento_huerfanos"
            | "rutina_activa_deficiente"
            | "series_sin_registro";
          referencia_id: string;
          alumno_id: string;
          estado: "descartado" | "penalizado";
          puntos_ajustados: number | null;
          nota: string | null;
          revisor_id: string;
          creado_en: string;
        };
        Insert: {
          // 0066_auditoria_tipos_hallazgo.sql amplió el check.
          tipo:
            | "sesion_duracion_imposible"
            | "puntos_entrenamiento_huerfanos"
            | "rutina_activa_deficiente"
            | "series_sin_registro";
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
      // 0085_actividad_contextual_alumno.sql
      actividad_alumno_eventos: {
        Row: {
          id: string;
          alumno_id: string;
          tipo: "alimentacion_vista" | "alimentacion_cambio";
          ocurrido_en: string;
          metadata: Record<string, string | number | boolean | null>;
        };
        Insert: {
          alumno_id: string;
          tipo: "alimentacion_vista" | "alimentacion_cambio";
          ocurrido_en?: string;
          metadata?: Record<string, string | number | boolean | null>;
        };
        Update: Partial<Database["public"]["Tables"]["actividad_alumno_eventos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "actividad_alumno_eventos_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "alumno_perfil";
            referencedColumns: ["user_id"];
          },
        ];
      };
      recompensas_vip_catalogo: {
        Row: { id: string; nombre: string; descripcion: string; tipo: "digital" | "servicio" | "fisica"; costo_puntos: number; stock: number | null; requiere_aprobacion: boolean; imagen_url: string | null; activo: boolean; vigente_desde: string; vigente_hasta: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; nombre: string; descripcion?: string; tipo: "digital" | "servicio" | "fisica"; costo_puntos: number; stock?: number | null; requiere_aprobacion?: boolean; imagen_url?: string | null; activo?: boolean; vigente_desde?: string; vigente_hasta?: string | null; created_at?: string; updated_at?: string };
        Update: { nombre?: string; descripcion?: string; tipo?: "digital" | "servicio" | "fisica"; costo_puntos?: number; stock?: number | null; requiere_aprobacion?: boolean; imagen_url?: string | null; activo?: boolean; vigente_desde?: string; vigente_hasta?: string | null; updated_at?: string };
        Relationships: [];
      };
      recompensas_vip_canjes: {
        Row: { id: string; alumno_id: string; recompensa_id: string; costo_congelado: number; estado: "solicitado" | "aprobado" | "entregado" | "rechazado" | "cancelado"; nota_admin: string | null; solicitado_en: string; actualizado_en: string; resuelto_por: string | null };
        Insert: { id?: string; alumno_id: string; recompensa_id: string; costo_congelado: number; estado?: "solicitado" | "aprobado" | "entregado" | "rechazado" | "cancelado"; nota_admin?: string | null; solicitado_en?: string; actualizado_en?: string; resuelto_por?: string | null };
        Update: { estado?: "solicitado" | "aprobado" | "entregado" | "rechazado" | "cancelado"; nota_admin?: string | null; actualizado_en?: string; resuelto_por?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      solicitar_canje_vip: { Args: { p_recompensa_id: string }; Returns: string };
      resolver_canje_vip: { Args: { p_canje_id: string; p_estado: string; p_nota?: string | null }; Returns: undefined };
      ajustar_stock_recompensa_vip: { Args: { p_recompensa_id: string; p_delta: number; p_sin_limite?: boolean }; Returns: number | null };
    };
    Enums: Record<string, never>;
  };
}
