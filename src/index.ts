import * as shells from './shells/index';
import { FoundShell } from './shells/shared';

export type Shell = FoundShell;

export function launchShell(shell: Shell, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    shells.launchShell(shell, path, reject).then(resolve).catch(reject);
  });
}

export async function getAvailableShells(): Promise<readonly Shell[]> {
  return await shells.getAvailableShells();
}
