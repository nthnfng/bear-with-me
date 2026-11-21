// Workstream C: background runtime. Hosts the brain inside the service worker:
// - loads/saves BarryState (STORAGE_KEYS.state), processing events one at a time
// - turns tab, idle, alarm and message activity into BarryEvents (stamping `now`)
// - pushes viewFor() to tabs after each event and executes BarryEffects
// - schedules a precise wake-up at brain.nextDeadline(), with the alarm as a safety net

export function startRuntime(): void {
  // TODO(WS-C)
  console.log('[barry] runtime started');
}
