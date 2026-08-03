"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FIELD_BASE } from "./Input";

/** Campo de contraseña con el ojito para mostrar/ocultar que ya trae
 * cualquier app de membresía — arranca oculta, como siempre. */
export function InputPassword({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={`${FIELD_BASE} pr-11 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
