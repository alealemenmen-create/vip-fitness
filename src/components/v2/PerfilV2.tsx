"use client";

import { useActionState, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  KeyRound,
  Mail,
  MessageSquareText,
  Save,
  ShieldCheck,
  Star,
  TimerReset,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  actualizarSegundosDescansoPreferido,
  actualizarTemporizadorDescansoAlumno,
  cambiarMiCorreo,
  guardarDatosPersonales,
  type FormState,
} from "@/app/alumno/perfil/actions";
import { enviarResenaApp, type EnviarResenaState } from "@/app/alumno/perfil/resena-actions";
import type { DatosPersonales } from "@/app/alumno/perfil/data";
import { createClient } from "@/lib/supabase/client";
import { SEXOS } from "@/lib/solicitudes/campos";
import styles from "./PortalV2.module.css";

const ESTADO_FORMULARIO: FormState = { error: null, ok: false };
const ESTADO_RESENA: EnviarResenaState = { error: null, ok: false };
const OPCIONES_SEGUNDOS = [45, 60, 90, 120, 150] as const;
type Seccion = "datos" | "descanso" | "seguridad" | "opinion";

export function PerfilV2({
  datos,
  temporizadorInicial,
  segundosIniciales,
}: {
  datos: DatosPersonales;
  temporizadorInicial: boolean;
  segundosIniciales: number | null;
}) {
  const [seccion, setSeccion] = useState<Seccion | null>("datos");
  const iniciales = useMemo(
    () =>
      datos.nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0]?.toUpperCase())
        .join("") || "VIP",
    [datos.nombre]
  );

  useEffect(() => {
    const abrirSeccionIndicada = () => {
      const destino = window.location.hash.slice(1);
      if (destino === "datos" || destino === "descanso" || destino === "seguridad" || destino === "opinion") {
        setSeccion(destino);
        window.requestAnimationFrame(() => document.getElementById(destino)?.scrollIntoView({ block: "start", behavior: "smooth" }));
      }
    };
    abrirSeccionIndicada();
    window.addEventListener("hashchange", abrirSeccionIndicada);
    return () => window.removeEventListener("hashchange", abrirSeccionIndicada);
  }, []);

  const alternar = (siguiente: Seccion) => setSeccion((actual) => (actual === siguiente ? null : siguiente));

  return (
    <div className={styles.profileV2Content}>
      <section className={styles.profileV2Identity} aria-label="Resumen de la cuenta">
        <span>{iniciales}</span>
        <div>
          <small>PERFIL DEL ALUMNO</small>
          <strong>{datos.nombre}</strong>
          <p>Tus datos reales, preferencias y acceso en un solo lugar.</p>
        </div>
        <ShieldCheck size={19} aria-label="Cuenta protegida" />
      </section>

      <div className={styles.profileV2Accordion}>
        <SeccionPerfil
          id="datos"
          titulo="Datos personales"
          detalle="Identidad, contacto y antecedentes"
          icono={<UserRound size={18} />}
          abierta={seccion === "datos"}
          onToggle={() => alternar("datos")}
        >
          <FormularioDatos datos={datos} />
        </SeccionPerfil>

        <SeccionPerfil
          id="descanso"
          titulo="Descanso y temporizador"
          detalle={temporizadorInicial ? "Automático · activo" : "Automático · desactivado"}
          icono={<TimerReset size={18} />}
          abierta={seccion === "descanso"}
          onToggle={() => alternar("descanso")}
        >
          <PreferenciasDescanso activoInicial={temporizadorInicial} segundosIniciales={segundosIniciales} />
        </SeccionPerfil>

        <SeccionPerfil
          id="seguridad"
          titulo="Seguridad y acceso"
          detalle="Contraseña y correo de la cuenta"
          icono={<ShieldCheck size={18} />}
          abierta={seccion === "seguridad"}
          onToggle={() => alternar("seguridad")}
        >
          <SeguridadCuenta />
        </SeccionPerfil>

        <SeccionPerfil
          id="opinion"
          titulo="Tu experiencia VIP"
          detalle="Ayúdanos a mejorar la plataforma"
          icono={<MessageSquareText size={18} />}
          abierta={seccion === "opinion"}
          onToggle={() => alternar("opinion")}
        >
          <ResenaV2 />
        </SeccionPerfil>
      </div>
    </div>
  );
}

function SeccionPerfil({
  id,
  titulo,
  detalle,
  icono,
  abierta,
  onToggle,
  children,
}: {
  id: Seccion;
  titulo: string;
  detalle: string;
  icono: React.ReactNode;
  abierta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.profileV2Section} data-open={abierta}>
      <button type="button" aria-expanded={abierta} aria-controls={`perfil-v2-${id}`} onClick={onToggle}>
        <span className={styles.profileV2SectionIcon}>{icono}</span>
        <span className={styles.profileV2SectionCopy}>
          <strong>{titulo}</strong>
          <small>{detalle}</small>
        </span>
        <ChevronDown size={18} />
      </button>
      {abierta ? <div id={`perfil-v2-${id}`} className={styles.profileV2Panel}>{children}</div> : null}
    </section>
  );
}

function FormularioDatos({ datos }: { datos: DatosPersonales }) {
  const [estado, accion, guardando] = useActionState(guardarDatosPersonales, ESTADO_FORMULARIO);
  return (
    <form action={accion} className={styles.profileV2Form}>
      <Campo etiqueta="Nombre" htmlFor="perfil-v2-nombre" anchoCompleto>
        <input id="perfil-v2-nombre" name="nombre" required defaultValue={datos.nombre} autoComplete="name" />
      </Campo>
      <Campo etiqueta="Fecha de nacimiento" htmlFor="perfil-v2-nacimiento">
        <input id="perfil-v2-nacimiento" name="fecha_nacimiento" type="date" defaultValue={datos.fechaNacimiento ?? ""} />
      </Campo>
      <Campo etiqueta="Teléfono (WhatsApp)" htmlFor="perfil-v2-telefono">
        <input id="perfil-v2-telefono" name="telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="+56 9 1234 5678" defaultValue={datos.telefono ?? ""} />
      </Campo>
      <Campo etiqueta="Sexo" htmlFor="perfil-v2-sexo">
        <select id="perfil-v2-sexo" name="sexo" defaultValue={datos.sexo ?? ""}>
          <option value="">Prefiero no decirlo</option>
          {SEXOS.filter((sexo) => sexo.valor !== "otro").map((sexo) => <option key={sexo.valor} value={sexo.valor}>{sexo.etiqueta}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Estatura (cm)" htmlFor="perfil-v2-estatura">
        <input id="perfil-v2-estatura" name="estatura_cm" type="number" step="0.5" min="80" max="260" inputMode="decimal" placeholder="170" defaultValue={datos.estaturaCm ?? ""} />
      </Campo>
      <Campo etiqueta="Condición médica" htmlFor="perfil-v2-medica" anchoCompleto>
        <textarea id="perfil-v2-medica" name="condicion_medica" rows={2} placeholder="Ninguna, asma, hipertensión, lesión previa…" defaultValue={datos.condicionMedica ?? ""} />
      </Campo>
      <Campo etiqueta="Alimentación y alergias" htmlFor="perfil-v2-alimentacion" anchoCompleto>
        <textarea id="perfil-v2-alimentacion" name="restriccion_alimenticia" rows={2} placeholder="Ninguna, vegetariano, alergia a maní…" defaultValue={datos.restriccionAlimenticia ?? ""} />
      </Campo>
      <Mensaje estado={estado} textoOk="Datos actualizados." />
      <button type="submit" className={styles.profileV2PrimaryButton} disabled={guardando}>
        <Save size={17} /> {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function Campo({ etiqueta, htmlFor, anchoCompleto = false, children }: { etiqueta: string; htmlFor: string; anchoCompleto?: boolean; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className={styles.profileV2Field} data-full={anchoCompleto}><span>{etiqueta}</span>{children}</label>;
}

function PreferenciasDescanso({ activoInicial, segundosIniciales }: { activoInicial: boolean; segundosIniciales: number | null }) {
  const [activo, setActivo] = useState(activoInicial);
  const [segundos, setSegundos] = useState<number | null>(segundosIniciales);
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, iniciar] = useTransition();

  const guardarActivo = (nuevo: boolean) => {
    const anterior = activo;
    setActivo(nuevo);
    setConfirmando(false);
    setMensaje(null);
    iniciar(async () => {
      try {
        const resultado = await actualizarTemporizadorDescansoAlumno(nuevo);
        if (!resultado.ok) {
          setActivo(anterior);
          setMensaje({ tipo: "error", texto: resultado.error ?? "No pudimos guardar esta preferencia." });
          return;
        }
        setMensaje({ tipo: "ok", texto: nuevo ? "Temporizador automático activado." : "Temporizador automático desactivado." });
      } catch {
        setActivo(anterior);
        setMensaje({ tipo: "error", texto: "No hubo conexión con el servidor. Tu preferencia anterior se conserva." });
      }
    });
  };

  const guardarSegundos = (nuevo: number | null) => {
    const anterior = segundos;
    setSegundos(nuevo);
    setMensaje(null);
    iniciar(async () => {
      try {
        const resultado = await actualizarSegundosDescansoPreferido(nuevo);
        if (!resultado.ok) {
          setSegundos(anterior);
          setMensaje({ tipo: "error", texto: resultado.error ?? "No pudimos guardar el descanso." });
          return;
        }
        setMensaje({ tipo: "ok", texto: nuevo === null ? "Usarás el descanso indicado por Alejandro." : `Descanso preferido: ${nuevo} segundos.` });
      } catch {
        setSegundos(anterior);
        setMensaje({ tipo: "error", texto: "No hubo conexión con el servidor. Tu descanso anterior se conserva." });
      }
    });
  };

  return (
    <div className={styles.profileV2Timer}>
      <div className={styles.profileV2SwitchRow}>
        <div><strong>Temporizador automático</strong><small>Inicia el descanso al completar cada serie.</small></div>
        <button type="button" role="switch" aria-label="Temporizador automático" aria-checked={activo} disabled={guardando} className={styles.profileV2Switch} data-active={activo} onClick={() => activo ? setConfirmando(true) : guardarActivo(true)}><i /></button>
      </div>
      {confirmando ? (
        <div className={styles.profileV2Warning}>
          <TriangleAlert size={18} />
          <div><strong>Vas a reducir tu puntuación</strong><p>Sin temporizador, una sesión finalizada pierde el bono de descanso controlado.</p></div>
          <button type="button" onClick={() => guardarActivo(false)}>Desactivar de todos modos</button>
          <button type="button" onClick={() => setConfirmando(false)}>Mantener activo</button>
        </div>
      ) : null}
      {activo ? (
        <div className={styles.profileV2TimerChoice}>
          <strong>Duración preferida</strong>
          <p>Puede respetar cada ejercicio o aplicar un tiempo fijo a toda la sesión.</p>
          <div>
            <button type="button" data-selected={segundos === null} disabled={guardando} onClick={() => guardarSegundos(null)}>Según Alejandro</button>
            {OPCIONES_SEGUNDOS.map((opcion) => <button type="button" key={opcion} data-selected={segundos === opcion} disabled={guardando} onClick={() => guardarSegundos(opcion)}>{opcion}s</button>)}
          </div>
        </div>
      ) : null}
      {mensaje ? <p role={mensaje.tipo === "error" ? "alert" : "status"} className={styles.profileV2InlineMessage} data-error={mensaje.tipo === "error"}>{mensaje.texto}</p> : null}
    </div>
  );
}

function SeguridadCuenta() {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [estadoPassword, setEstadoPassword] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [estadoCorreo, accionCorreo, cambiandoCorreo] = useActionState(cambiarMiCorreo, ESTADO_FORMULARIO);

  async function cambiarPassword(evento: FormEvent) {
    evento.preventDefault();
    setEstadoPassword(null);
    if (nueva.length < 8) return setEstadoPassword({ tipo: "error", texto: "Usa al menos 8 caracteres." });
    if (nueva !== confirmar) return setEstadoPassword({ tipo: "error", texto: "Las contraseñas no coinciden." });
    setCambiandoPassword(true);
    const { error } = await createClient().auth.updateUser({ password: nueva });
    setCambiandoPassword(false);
    if (error) return setEstadoPassword({ tipo: "error", texto: "No pudimos cambiar la contraseña. Intenta nuevamente." });
    setNueva("");
    setConfirmar("");
    setEstadoPassword({ tipo: "ok", texto: "Contraseña actualizada." });
  }

  return (
    <div className={styles.profileV2Security}>
      <form onSubmit={cambiarPassword}>
        <div className={styles.profileV2Subheading}><KeyRound size={17} /><div><strong>Contraseña</strong><small>Mínimo 8 caracteres.</small></div></div>
        <Campo etiqueta="Nueva contraseña" htmlFor="perfil-v2-password"><input id="perfil-v2-password" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={8} autoComplete="new-password" /></Campo>
        <Campo etiqueta="Confirmar contraseña" htmlFor="perfil-v2-password-confirm"><input id="perfil-v2-password-confirm" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} minLength={8} autoComplete="new-password" /></Campo>
        {estadoPassword ? <p role={estadoPassword.tipo === "error" ? "alert" : "status"} className={styles.profileV2InlineMessage} data-error={estadoPassword.tipo === "error"}>{estadoPassword.texto}</p> : null}
        <button type="submit" className={styles.profileV2SecondaryButton} disabled={cambiandoPassword}>{cambiandoPassword ? "Actualizando…" : "Cambiar contraseña"}</button>
      </form>
      <form action={accionCorreo}>
        <div className={styles.profileV2Subheading}><Mail size={17} /><div><strong>Correo de acceso</strong><small>Se usa para iniciar sesión y recuperar la cuenta.</small></div></div>
        <Campo etiqueta="Nuevo correo" htmlFor="perfil-v2-correo" anchoCompleto><input id="perfil-v2-correo" type="email" name="correo" required autoComplete="email" placeholder="nombre@correo.cl" /></Campo>
        <Mensaje estado={estadoCorreo} textoOk="Correo actualizado." />
        <button type="submit" className={styles.profileV2SecondaryButton} disabled={cambiandoCorreo}>{cambiandoCorreo ? "Actualizando…" : "Cambiar correo"}</button>
      </form>
    </div>
  );
}

function ResenaV2() {
  const [estado, accion, enviando] = useActionState(enviarResenaApp, ESTADO_RESENA);
  const [estrellas, setEstrellas] = useState(0);
  const pathname = usePathname();
  if (estado.ok) return <div className={styles.profileV2Thanks}><Check size={22} /><strong>Gracias por ayudarnos a mejorar.</strong><p>Tu opinión ya llegó al equipo VIP.</p></div>;
  return (
    <form action={accion} className={styles.profileV2Review}>
      <input type="hidden" name="estrellas" value={estrellas} />
      <input type="hidden" name="ruta" value={pathname ?? "/portal-v2/perfil"} />
      <p>¿Cómo ha sido tu experiencia con Portal VIP V2?</p>
      <div role="radiogroup" aria-label="Puntuación de 1 a 5 estrellas">
        {[1, 2, 3, 4, 5].map((valor) => <button key={valor} type="button" role="radio" aria-checked={estrellas === valor} aria-label={`${valor} ${valor === 1 ? "estrella" : "estrellas"}`} onClick={() => setEstrellas(valor)}><Star size={27} data-active={valor <= estrellas} /></button>)}
      </div>
      <Campo etiqueta="Comentario opcional" htmlFor="perfil-v2-resena" anchoCompleto><textarea id="perfil-v2-resena" name="sugerencia" rows={3} maxLength={2000} placeholder="Cuéntanos qué mejorarías…" /></Campo>
      {estado.error ? <p role="alert" className={styles.profileV2InlineMessage} data-error="true">{estado.error}</p> : null}
      <button type="submit" className={styles.profileV2PrimaryButton} disabled={enviando || estrellas === 0}>{enviando ? "Enviando…" : "Enviar opinión"}</button>
    </form>
  );
}

function Mensaje({ estado, textoOk }: { estado: FormState; textoOk: string }) {
  if (!estado.error && !estado.ok) return null;
  return <p role={estado.error ? "alert" : "status"} className={styles.profileV2InlineMessage} data-error={Boolean(estado.error)}>{estado.error ?? textoOk}</p>;
}
