import type { Session } from "@/core/auth/types"

export type AdminOrderSummary = {
  label: string
  value: string
}

export type AdminDriverSummary = {
  label: string
  value: string
}

export type AdminNotificationSummary = {
  label: string
  value: string
}

export async function loadAdminOrderSummary(): Promise<AdminOrderSummary | null> {
  try {
    return {
      label: "Orders",
      value: "0",
    }
  } catch {
    return null
  }
}

export async function loadAdminDriverSummary(): Promise<AdminDriverSummary | null> {
  try {
    return {
      label: "Drivers",
      value: "0",
    }
  } catch {
    return null
  }
}

export async function loadAdminNotificationSummary(): Promise<AdminNotificationSummary | null> {
  try {
    return {
      label: "Notifications",
      value: "0",
    }
  } catch {
    return null
  }
}

export type AdminDashboardData = {
  orders: AdminOrderSummary | null
  drivers: AdminDriverSummary | null
  notifications: AdminNotificationSummary | null
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  const [orders, drivers, notifications] = await Promise.all([
    loadAdminOrderSummary().catch(() => null),
    loadAdminDriverSummary().catch(() => null),
    loadAdminNotificationSummary().catch(() => null),
  ])

  return {
    orders,
    drivers,
    notifications,
  }
}
