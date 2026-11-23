import { hermite, spinDuration } from './wheelGeometry';

/** Frame scheduling, injectable so the controller can be tested without a browser. */
export interface FrameClock {
  now(): number;
  request(cb: (t: number) => void): number;
  cancel(id: number): void;
}

const browserClock: FrameClock = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export interface SpinOptions {
  /** Start velocity in rad/ms; defaults to the current velocity, so an interrupted spin carries on smoothly. */
  v0?: number;
  /** Jump without animating (reduced motion, first paint). */
  instant?: boolean;
}

/**
 * Drives the wheel's rotation outside React: one requestAnimationFrame loop writes the angle through `apply`,
 * so no component re-renders while the wheel turns. A new target mid-spin replaces the old one and starts from
 * the current angle and velocity. `onSettle` runs once when a spin ends, and not for a spin that was replaced.
 */
export class Spinner {
  private angle: number;
  private velocity = 0;
  private frame: number | null = null;
  private from = 0;
  private to = 0;
  private v0 = 0;
  private start = 0;
  private duration = 0;
  private samples: { t: number; a: number }[] = [];

  constructor(
    initial: number,
    private readonly apply: (angle: number, velocity: number) => void,
    private readonly onSettle: () => void,
    private readonly clock: FrameClock = browserClock,
  ) {
    this.angle = initial;
  }

  get current(): number {
    return this.angle;
  }

  get moving(): boolean {
    return this.frame !== null;
  }

  /** Spin to an absolute angle (already unwrapped by the caller to take the intended path). */
  spinTo(target: number, opts: SpinOptions = {}): void {
    this.stopFrame();
    if (opts.instant || Math.abs(target - this.angle) < 1e-6) {
      this.angle = target;
      this.velocity = 0;
      this.apply(this.angle, 0);
      this.onSettle();
      return;
    }
    this.from = this.angle;
    this.to = target;
    this.v0 = opts.v0 ?? this.velocity;
    // Keep a strong start velocity from bending the curve into a wild overshoot.
    const limit = (3 * Math.abs(target - this.angle) + 0.5) / 600;
    this.v0 = Math.max(-limit, Math.min(limit, this.v0));
    this.duration = spinDuration(target - this.angle);
    this.start = this.clock.now();
    this.frame = this.clock.request(this.tick);
  }

  /** Follow a drag directly; the recent samples give the release velocity. */
  drag(angle: number): void {
    this.stopFrame();
    const t = this.clock.now();
    this.samples.push({ t, a: angle });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
    const first = this.samples[0];
    this.velocity = t > first.t ? (angle - first.a) / (t - first.t) : 0;
    this.angle = angle;
    this.apply(angle, this.velocity);
  }

  /** Velocity at release, in rad/ms; zero when the pointer rested before letting go. */
  release(): number {
    const t = this.clock.now();
    const last = this.samples[this.samples.length - 1];
    const v = last && t - last.t < 80 ? this.velocity : 0;
    this.samples = [];
    this.velocity = v;
    return v;
  }

  /** Stop where it is, without settling (the component is going away, or a drag takes over). */
  stop(): void {
    this.stopFrame();
    this.velocity = 0;
    this.samples = [];
  }

  private stopFrame(): void {
    if (this.frame !== null) {
      this.clock.cancel(this.frame);
      this.frame = null;
    }
  }

  private tick = (): void => {
    const t = this.clock.now() - this.start;
    const { p, v } = hermite(this.from, this.to, this.v0, this.duration, t);
    this.angle = p;
    this.velocity = v;
    this.apply(p, v);
    if (t >= this.duration) {
      this.frame = null;
      this.velocity = 0;
      this.onSettle();
    } else {
      this.frame = this.clock.request(this.tick);
    }
  };
}
