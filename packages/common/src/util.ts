export const nowUnix = () => Math.floor(Date.now() / 1000);
export function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
