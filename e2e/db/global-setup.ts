import { zetSandboxKlaar } from './helpers/db'

/** Sandboxteam aanmaken of terugzetten vóór de suite; faalt luid als de vangrail afgaat. */
export default async function globalSetup(): Promise<void> {
  await zetSandboxKlaar()
}
