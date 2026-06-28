"use client"

import DriverDocumentTask from "@/components/driver/tasks/document"

export default function DriverSafetyTask({ on_saved }: Readonly<{ on_saved: () => void }>) {
  return (
    <DriverDocumentTask
      task_key="safety_manager"
      on_saved={on_saved}
      documents={[{ item: "safety_manager", status: "acquired", label: "修了証" }]}
    />
  )
}
