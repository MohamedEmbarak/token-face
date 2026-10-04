/** Context-window readings, oldest first: one per turn, the last 13 kept. */
export type Forecast = { window: number; readings: number[] }

declare module 'claude-code' {
  interface PluginState {
    'token-face': { forecast: Forecast | null }
  }
}
