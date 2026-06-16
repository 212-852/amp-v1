export default function AdminPageFallback({
  message,
}: Readonly<{
  message?: string | null
}>) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Admin page failed to render</h1>
      <p>Please check debug logs.</p>
      {process.env.NODE_ENV !== "production" && message ? (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f5f5f5",
            borderRadius: 8,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {message}
        </pre>
      ) : null}
    </main>
  )
}
