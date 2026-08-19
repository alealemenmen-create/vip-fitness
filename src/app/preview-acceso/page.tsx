export default async function PreviewAccesoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#050505", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "min(100%, 420px)", padding: 28, border: "1px solid #303030", borderRadius: 28, background: "linear-gradient(135deg, #0a0a0a, #191919)" }}>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 13, letterSpacing: 2 }}>PRUEBA PRIVADA</p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 30 }}>VIP Fitness V2</h1>
        <p style={{ margin: "0 0 24px", color: "#b8b8b8", lineHeight: 1.5 }}>Ingresa la llave individual que te entregó VIP Fitness.</p>
        <form action="/preview-acceso/autorizar" method="post">
          <label htmlFor="codigo" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>Llave de acceso</label>
          <input id="codigo" name="codigo" type="password" required autoComplete="one-time-code" style={{ boxSizing: "border-box", width: "100%", minHeight: 52, padding: "0 16px", border: "1px solid #3c3c3c", borderRadius: 16, background: "#111", color: "#fff", fontSize: 18 }} />
          {error ? <p role="alert" style={{ color: "#ff8a8a", margin: "12px 0 0" }}>La llave no es válida. Revisa que esté escrita completa.</p> : null}
          <button type="submit" style={{ width: "100%", minHeight: 52, marginTop: 18, border: 0, borderRadius: 16, background: "#fff", color: "#050505", fontSize: 17, fontWeight: 800 }}>Entrar a la preview</button>
        </form>
      </section>
    </main>
  );
}
