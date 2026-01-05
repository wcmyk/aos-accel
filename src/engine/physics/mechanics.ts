/**
 * Classical Mechanics
 * Features:
 * - Kinematics (motion equations)
 * - Dynamics (forces, Newton's laws)
 * - Energy and momentum
 * - Rotational mechanics
 * - Oscillations
 */

import { Vector, Matrix } from '../types-advanced';
import { createVector, dotProduct, crossProduct, magnitude } from '../math/linalg';
import { derivative, secondDerivative } from '../math/calculus';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KINEMATICS (1D & 3D)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Position from initial conditions (constant acceleration)
 * x(t) = x₀ + v₀t + ½at²
 */
export function position1D(
  x0: number,
  v0: number,
  a: number,
  t: number
): number {
  return x0 + v0 * t + 0.5 * a * t * t;
}

/**
 * Velocity from initial conditions (constant acceleration)
 * v(t) = v₀ + at
 */
export function velocity1D(v0: number, a: number, t: number): number {
  return v0 + a * t;
}

/**
 * Final velocity from kinematics
 * v² = v₀² + 2aΔx
 */
export function finalVelocity(v0: number, a: number, dx: number): number {
  return Math.sqrt(v0 * v0 + 2 * a * dx);
}

/**
 * Time to reach position (quadratic formula)
 */
export function timeToPosition(
  x0: number,
  v0: number,
  a: number,
  x: number
): { t1: number; t2: number } {
  const dx = x - x0;
  const discriminant = v0 * v0 + 2 * a * dx;

  if (discriminant < 0) {
    throw new Error('No real solution - position unreachable');
  }

  const t1 = (-v0 + Math.sqrt(discriminant)) / a;
  const t2 = (-v0 - Math.sqrt(discriminant)) / a;

  return { t1, t2 };
}

/**
 * 3D position vector
 */
export function position3D(
  r0: Vector,
  v0: Vector,
  a: Vector,
  t: number
): Vector {
  const result = [];
  for (let i = 0; i < 3; i++) {
    result.push(r0.data[i] + v0.data[i] * t + 0.5 * a.data[i] * t * t);
  }
  return createVector(result);
}

/**
 * Projectile motion (2D)
 */
export interface ProjectileState {
  position: Vector;
  velocity: Vector;
  time: number;
}

export function projectileMotion(
  v0: number,
  angle: number,
  g: number = 9.81,
  h0: number = 0
): {
  maxHeight: number;
  range: number;
  flightTime: number;
  trajectory: (t: number) => ProjectileState;
} {
  const v0x = v0 * Math.cos(angle);
  const v0y = v0 * Math.sin(angle);

  const maxHeight = h0 + (v0y * v0y) / (2 * g);
  const flightTime = (v0y + Math.sqrt(v0y * v0y + 2 * g * h0)) / g;
  const range = v0x * flightTime;

  const trajectory = (t: number): ProjectileState => {
    return {
      position: createVector([v0x * t, h0 + v0y * t - 0.5 * g * t * t]),
      velocity: createVector([v0x, v0y - g * t]),
      time: t,
    };
  };

  return { maxHeight, range, flightTime, trajectory };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DYNAMICS (Forces)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Newton's second law: F = ma
 */
export function force(m: number, a: Vector): Vector {
  return createVector(a.data.map((ai) => m * ai));
}

/**
 * Acceleration from force: a = F/m
 */
export function acceleration(F: Vector, m: number): Vector {
  return createVector(F.data.map((Fi) => Fi / m));
}

/**
 * Gravitational force: F = -GMm/r² r̂
 */
export function gravitationalForce(
  m1: number,
  m2: number,
  r: Vector,
  G: number = 6.674e-11
): Vector {
  const rMag = magnitude(r);
  const forceMag = (G * m1 * m2) / (rMag * rMag);

  // Unit vector in r direction
  const rHat = createVector(r.data.map((ri) => ri / rMag));

  // Force is attractive (negative direction)
  return createVector(rHat.data.map((ri) => -forceMag * ri));
}

/**
 * Spring force: F = -kx
 */
export function springForce(k: number, x: number): number {
  return -k * x;
}

/**
 * Drag force: F = -bv (linear) or F = -cv²v̂ (quadratic)
 */
export function dragForce(
  v: Vector,
  b: number,
  quadratic: boolean = false
): Vector {
  if (!quadratic) {
    return createVector(v.data.map((vi) => -b * vi));
  } else {
    const vMag = magnitude(v);
    const dragMag = b * vMag * vMag;
    const vHat = createVector(v.data.map((vi) => vi / vMag));
    return createVector(vHat.data.map((vi) => -dragMag * vi));
  }
}

/**
 * Friction force: F = μN
 */
export function frictionForce(mu: number, N: number): number {
  return mu * N;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENERGY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Kinetic energy: KE = ½mv²
 */
export function kineticEnergy(m: number, v: Vector): number {
  const vMag = magnitude(v);
  return 0.5 * m * vMag * vMag;
}

/**
 * Gravitational potential energy: PE = mgh
 */
export function gravitationalPotentialEnergy(m: number, h: number, g: number = 9.81): number {
  return m * g * h;
}

/**
 * Elastic potential energy: PE = ½kx²
 */
export function elasticPotentialEnergy(k: number, x: number): number {
  return 0.5 * k * x * x;
}

/**
 * Work done by force: W = F·d
 */
export function work(F: Vector, d: Vector): number {
  return dotProduct(F, d);
}

/**
 * Power: P = F·v
 */
export function power(F: Vector, v: Vector): number {
  return dotProduct(F, v);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOMENTUM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Linear momentum: p = mv
 */
export function momentum(m: number, v: Vector): Vector {
  return createVector(v.data.map((vi) => m * vi));
}

/**
 * Impulse: J = Δp = FΔt
 */
export function impulse(F: Vector, dt: number): Vector {
  return createVector(F.data.map((Fi) => Fi * dt));
}

/**
 * Elastic collision (1D)
 */
export function elasticCollision1D(
  m1: number,
  v1: number,
  m2: number,
  v2: number
): { v1f: number; v2f: number } {
  const v1f = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
  const v2f = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);

  return { v1f, v2f };
}

/**
 * Inelastic collision (1D)
 */
export function inelasticCollision1D(
  m1: number,
  v1: number,
  m2: number,
  v2: number,
  e: number = 0
): { vf: number; energyLoss: number } {
  // Coefficient of restitution: e = (v2f - v1f) / (v1 - v2)
  // e = 0: perfectly inelastic, e = 1: perfectly elastic

  const vf = (m1 * v1 + m2 * v2) / (m1 + m2);

  if (e === 0) {
    // Perfectly inelastic (stick together)
    const KEi = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
    const KEf = 0.5 * (m1 + m2) * vf * vf;
    const energyLoss = KEi - KEf;

    return { vf, energyLoss };
  } else {
    // General case
    const v1f = ((m1 - e * m2) * v1 + m2 * (1 + e) * v2) / (m1 + m2);
    const v2f = ((m2 - e * m1) * v2 + m1 * (1 + e) * v1) / (m1 + m2);

    const KEi = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
    const KEf = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
    const energyLoss = KEi - KEf;

    return { vf: v2f, energyLoss };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROTATIONAL MECHANICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Angular velocity: ω = v/r
 */
export function angularVelocity(v: number, r: number): number {
  return v / r;
}

/**
 * Torque: τ = r × F
 */
export function torque(r: Vector, F: Vector): Vector {
  return crossProduct(r, F);
}

/**
 * Angular momentum: L = r × p
 */
export function angularMomentum(r: Vector, p: Vector): Vector {
  return crossProduct(r, p);
}

/**
 * Moment of inertia for common shapes
 */
export const momentOfInertia = {
  pointMass: (m: number, r: number) => m * r * r,
  rod: (m: number, L: number) => (1 / 12) * m * L * L,
  disk: (m: number, R: number) => 0.5 * m * R * R,
  sphere: (m: number, R: number) => (2 / 5) * m * R * R,
  hollowSphere: (m: number, R: number) => (2 / 3) * m * R * R,
  cylinder: (m: number, R: number) => 0.5 * m * R * R,
};

/**
 * Rotational kinetic energy: KE = ½Iω²
 */
export function rotationalKineticEnergy(I: number, omega: number): number {
  return 0.5 * I * omega * omega;
}

/**
 * Rolling motion (no slipping)
 */
export function rollingMotion(
  v: number,
  R: number
): { omega: number; KE_translational: number; KE_rotational: number; ratio: number } {
  const omega = v / R;
  const m = 1; // Normalized mass
  const I = 0.5 * m * R * R; // Disk

  const KE_trans = 0.5 * m * v * v;
  const KE_rot = 0.5 * I * omega * omega;

  return {
    omega,
    KE_translational: KE_trans,
    KE_rotational: KE_rot,
    ratio: KE_rot / KE_trans,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OSCILLATIONS (Harmonic Motion)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface OscillatorParams {
  m: number; // mass
  k: number; // spring constant
  b?: number; // damping coefficient
  F0?: number; // driving force amplitude
  omegaD?: number; // driving frequency
}

/**
 * Simple harmonic oscillator: x(t) = A cos(ωt + φ)
 */
export function simpleHarmonicOscillator(
  params: OscillatorParams,
  A: number,
  phi: number
): (t: number) => { x: number; v: number; a: number; E: number } {
  const omega = Math.sqrt(params.k / params.m);

  return (t: number) => {
    const x = A * Math.cos(omega * t + phi);
    const v = -A * omega * Math.sin(omega * t + phi);
    const a = -A * omega * omega * Math.cos(omega * t + phi);

    const KE = 0.5 * params.m * v * v;
    const PE = 0.5 * params.k * x * x;
    const E = KE + PE;

    return { x, v, a, E };
  };
}

/**
 * Damped harmonic oscillator
 */
export function dampedHarmonicOscillator(
  params: OscillatorParams,
  x0: number,
  v0: number
): (t: number) => { x: number; v: number; regime: 'underdamped' | 'critically-damped' | 'overdamped' } {
  const { m, k, b = 0 } = params;

  const omega0 = Math.sqrt(k / m);
  const gamma = b / (2 * m);
  const discriminant = gamma * gamma - omega0 * omega0;

  if (discriminant < 0) {
    // Underdamped
    const omegaD = Math.sqrt(omega0 * omega0 - gamma * gamma);
    const A = x0;
    const B = (v0 + gamma * x0) / omegaD;

    return (t: number) => {
      const expTerm = Math.exp(-gamma * t);
      const x = expTerm * (A * Math.cos(omegaD * t) + B * Math.sin(omegaD * t));
      const v =
        expTerm *
        ((-gamma * A + omegaD * B) * Math.cos(omegaD * t) +
          (-gamma * B - omegaD * A) * Math.sin(omegaD * t));

      return { x, v, regime: 'underdamped' as const };
    };
  } else if (discriminant === 0) {
    // Critically damped
    const A = x0;
    const B = v0 + gamma * x0;

    return (t: number) => {
      const expTerm = Math.exp(-gamma * t);
      const x = expTerm * (A + B * t);
      const v = expTerm * (B - gamma * (A + B * t));

      return { x, v, regime: 'critically-damped' as const };
    };
  } else {
    // Overdamped
    const r1 = -gamma + Math.sqrt(discriminant);
    const r2 = -gamma - Math.sqrt(discriminant);
    const A = (v0 - r2 * x0) / (r1 - r2);
    const B = (v0 - r1 * x0) / (r2 - r1);

    return (t: number) => {
      const x = A * Math.exp(r1 * t) + B * Math.exp(r2 * t);
      const v = A * r1 * Math.exp(r1 * t) + B * r2 * Math.exp(r2 * t);

      return { x, v, regime: 'overdamped' as const };
    };
  }
}

/**
 * Driven harmonic oscillator (steady state)
 */
export function drivenHarmonicOscillator(
  params: OscillatorParams
): (t: number) => { x: number; v: number; amplitude: number; phase: number; resonance: number } {
  const { m, k, b = 0, F0 = 1, omegaD = 1 } = params;

  const omega0 = Math.sqrt(k / m);
  const gamma = b / (2 * m);

  // Steady-state amplitude
  const amplitude =
    F0 / m / Math.sqrt((omega0 * omega0 - omegaD * omegaD) ** 2 + (2 * gamma * omegaD) ** 2);

  // Phase lag
  const phase = Math.atan2(2 * gamma * omegaD, omega0 * omega0 - omegaD * omegaD);

  // Resonance frequency
  const omegaRes = Math.sqrt(omega0 * omega0 - 2 * gamma * gamma);

  return (t: number) => {
    const x = amplitude * Math.cos(omegaD * t - phase);
    const v = -amplitude * omegaD * Math.sin(omegaD * t - phase);

    return { x, v, amplitude, phase, resonance: omegaRes };
  };
}

/**
 * Pendulum (small angle approximation)
 */
export function simplePendulum(
  L: number,
  g: number = 9.81,
  theta0: number,
  omega0: number = 0
): (t: number) => { theta: number; omega: number; period: number } {
  const omega = Math.sqrt(g / L);
  const period = 2 * Math.PI / omega;

  const A = theta0;
  const B = omega0 / omega;

  return (t: number) => {
    const theta = A * Math.cos(omega * t) + B * Math.sin(omega * t);
    const omegaT = -A * omega * Math.sin(omega * t) + B * omega * Math.cos(omega * t);

    return { theta, omega: omegaT, period };
  };
}
