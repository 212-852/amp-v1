export async function POST() {
  return Response.json(
    {
      deprecated: true,
      message: "Heartbeat moved to /api/visitors/state",
      use: "/api/visitors/state",
    },
    { status: 410 },
  )
}
