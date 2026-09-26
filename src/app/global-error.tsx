"use client";

type GlobalErrorProps = {
  retry: () => void;
};

export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          alignItems: "center",
          background: "#fafaf9",
          color: "#0f172a",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "440px", textAlign: "center" }}>
          <h1>O Shootit encontrou um problema.</h1>
          <p>Tente recarregar a aplicação.</p>
          <button onClick={() => retry()} type="button">
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
