"use client"

import DriverDocumentTask from "@/components/driver/tasks/document"

export default function DriverVehicleTask({ on_saved }: Readonly<{ on_saved: () => void }>) {
  return (
    <DriverDocumentTask
      task_key="vehicle"
      on_saved={on_saved}
      documents={[{ item: "vehicle", status: "registered", label: "車両情報・写真" }]}
    />
  )
}
