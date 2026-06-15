export async function POST() {
  return Response.json(
    {
      deprecated: true,
      message: "Access state moved to /api/visitors/state",
      use: "/api/visitors/state",
    },
    { status: 410 },
  )
}
