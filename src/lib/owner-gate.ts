export const OWNER_GATE = {
  accs: "QWENNO1",
  pw: "QWENCV1",
  username: "QWENB1",
} as const;

export function ownerMatches(accs: string, pw: string, username: string): boolean {
  return accs.trim() === OWNER_GATE.accs && pw.trim() === OWNER_GATE.pw && username.trim() === OWNER_GATE.username;
}
