import { resetSandbox } from './helpers/db'

/** Geen testwedstrijden laten staan; het (verborgen) sandboxteam en zijn spelers blijven. */
export default async function globalTeardown(): Promise<void> {
  await resetSandbox()
}
