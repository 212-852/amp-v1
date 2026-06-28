"use client"

import DriverDocumentTask from "@/components/driver/tasks/document"

export default function DriverOperatorTask({ on_saved }: Readonly<{ on_saved: () => void }>) {
  return (
    <DriverDocumentTask
      task_key="freight_operator"
      on_saved={on_saved}
      documents={[
        { item: "freight_operator", status: "acquired", label: "許可証" },
        { item: "black_plate", status: "issued", label: "黒ナンバー" },
      ]}
    />
  )
}
