// Time source for the simulation. Tests set `speed` to 0 so mock work finishes instantly.
export const clock = {
  speed: 1,
  now: (): string => new Date().toISOString(),
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.round(ms * clock.speed)));
  },
};
