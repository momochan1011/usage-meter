export type MeterLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type MeterReading = {
  limits: MeterLimit[]
  contextPercent?: number
  updatedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { reading: MeterReading }
  }
}
