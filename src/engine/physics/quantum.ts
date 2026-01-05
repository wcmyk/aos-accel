/**
 * Quantum Mechanics (Simplified)
 * Features:
 * - Wave functions and operators
 * - Schrödinger equation solutions
 * - Quantum states
 * - Uncertainty principle
 * - Quantum harmonic oscillator
 */

import { Vector, Matrix } from '../types-advanced';
import { createVector, createMatrix, dotProduct, magnitude } from '../math/linalg';
import { derivative, secondDerivative, simpsonsRule } from '../math/calculus';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHYSICAL CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const h = 6.62607015e-34; // Planck's constant (J·s)
export const hbar = h / (2 * Math.PI); // Reduced Planck's constant
export const m_e = 9.1093837015e-31; // Electron mass (kg)
export const e = 1.602176634e-19; // Elementary charge (C)
export const k_B = 1.380649e-23; // Boltzmann constant (J/K)
export const c = 299792458; // Speed of light (m/s)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WAVE FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type WaveFunction = (x: number) => { real: number; imag: number };

/**
 * Probability density: |ψ|²
 */
export function probabilityDensity(psi: WaveFunction, x: number): number {
  const { real, imag } = psi(x);
  return real * real + imag * imag;
}

/**
 * Normalize wave function
 */
export function normalizeWaveFunction(
  psi: WaveFunction,
  xMin: number,
  xMax: number,
  points: number = 1000
): WaveFunction {
  // Compute normalization constant
  const probDensity = (x: number) => probabilityDensity(psi, x);
  const norm = simpsonsRule(probDensity, xMin, xMax, points);
  const normalization = 1 / Math.sqrt(norm);

  return (x: number) => {
    const { real, imag } = psi(x);
    return {
      real: real * normalization,
      imag: imag * normalization,
    };
  };
}

/**
 * Expectation value: ⟨A⟩ = ∫ ψ* A ψ dx
 */
export function expectationValue(
  psi: WaveFunction,
  operator: (psi: WaveFunction) => WaveFunction,
  xMin: number,
  xMax: number,
  points: number = 1000
): number {
  const Apsi = operator(psi);

  const integrand = (x: number) => {
    const psiVal = psi(x);
    const ApsiVal = Apsi(x);

    // ψ* A ψ (real part for Hermitian operators)
    return psiVal.real * ApsiVal.real + psiVal.imag * ApsiVal.imag;
  };

  return simpsonsRule(integrand, xMin, xMax, points);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUANTUM OPERATORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Position operator: x̂ ψ = x ψ
 */
export function positionOperator(psi: WaveFunction): WaveFunction {
  return (x: number) => {
    const { real, imag } = psi(x);
    return { real: x * real, imag: x * imag };
  };
}

/**
 * Momentum operator: p̂ ψ = -iℏ ∂ψ/∂x
 */
export function momentumOperator(psi: WaveFunction, dx: number = 1e-8): WaveFunction {
  return (x: number) => {
    const psiPlus = psi(x + dx);
    const psiMinus = psi(x - dx);

    // Derivative
    const dReal = (psiPlus.real - psiMinus.real) / (2 * dx);
    const dImag = (psiPlus.imag - psiMinus.imag) / (2 * dx);

    // Multiply by -iℏ: -i(a + bi) = b - ai
    return {
      real: hbar * dImag,
      imag: -hbar * dReal,
    };
  };
}

/**
 * Kinetic energy operator: T̂ = -ℏ²/(2m) ∂²/∂x²
 */
export function kineticEnergyOperator(
  psi: WaveFunction,
  mass: number,
  dx: number = 1e-8
): WaveFunction {
  return (x: number) => {
    const psiCenter = psi(x);
    const psiPlus = psi(x + dx);
    const psiMinus = psi(x - dx);

    // Second derivative
    const d2Real = (psiPlus.real - 2 * psiCenter.real + psiMinus.real) / (dx * dx);
    const d2Imag = (psiPlus.imag - 2 * psiCenter.imag + psiMinus.imag) / (dx * dx);

    const factor = -(hbar * hbar) / (2 * mass);

    return {
      real: factor * d2Real,
      imag: factor * d2Imag,
    };
  };
}

/**
 * Hamiltonian operator: Ĥ = T̂ + V̂
 */
export function hamiltonianOperator(
  psi: WaveFunction,
  V: (x: number) => number,
  mass: number,
  dx: number = 1e-8
): WaveFunction {
  const Tpsi = kineticEnergyOperator(psi, mass, dx);

  return (x: number) => {
    const { real, imag } = psi(x);
    const Vpsi = V(x);
    const Tval = Tpsi(x);

    return {
      real: Tval.real + Vpsi * real,
      imag: Tval.imag + Vpsi * imag,
    };
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYTIC SOLUTIONS (Common Systems)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Free particle (plane wave)
 */
export function freeparticle(
  k: number,
  A: number = 1
): { psi: WaveFunction; energy: number; momentum: number } {
  const energy = (hbar * hbar * k * k) / (2 * m_e);
  const momentum = hbar * k;

  const psi: WaveFunction = (x: number) => {
    return {
      real: A * Math.cos(k * x),
      imag: A * Math.sin(k * x),
    };
  };

  return { psi, energy, momentum };
}

/**
 * Particle in a box (infinite square well)
 */
export function particleInBox(
  n: number,
  L: number,
  mass: number = m_e
): { psi: WaveFunction; energy: number; nodes: number } {
  const energy = (n * n * Math.PI * Math.PI * hbar * hbar) / (2 * mass * L * L);
  const nodes = n - 1;

  const normalization = Math.sqrt(2 / L);

  const psi: WaveFunction = (x: number) => {
    if (x < 0 || x > L) {
      return { real: 0, imag: 0 };
    }

    const real = normalization * Math.sin((n * Math.PI * x) / L);
    return { real, imag: 0 };
  };

  return { psi, energy, nodes };
}

/**
 * Quantum harmonic oscillator
 */
export function quantumHarmonicOscillator(
  n: number,
  omega: number,
  mass: number = m_e
): { psi: WaveFunction; energy: number; alpha: number } {
  const energy = hbar * omega * (n + 0.5);
  const alpha = Math.sqrt((mass * omega) / hbar);

  // Hermite polynomials (first few)
  const hermite = (n: number, x: number): number => {
    if (n === 0) return 1;
    if (n === 1) return 2 * x;
    if (n === 2) return 4 * x * x - 2;
    if (n === 3) return 8 * x ** 3 - 12 * x;
    if (n === 4) return 16 * x ** 4 - 48 * x * x + 12;

    // Recursive: H_{n+1} = 2x H_n - 2n H_{n-1}
    let Hn_1 = 4 * x ** 4 - 48 * x * x + 12;
    let Hn = 8 * x ** 3 - 12 * x;

    for (let i = 4; i < n; i++) {
      const Hn1 = 2 * x * Hn - 2 * i * Hn_1;
      Hn_1 = Hn;
      Hn = Hn1;
    }

    return Hn;
  };

  const normalization = Math.sqrt(alpha / (Math.sqrt(Math.PI) * Math.pow(2, n) * factorial(n)));

  const psi: WaveFunction = (x: number) => {
    const xi = alpha * x;
    const real = normalization * hermite(n, xi) * Math.exp((-xi * xi) / 2);
    return { real, imag: 0 };
  };

  return { psi, energy, alpha };
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Hydrogen atom (radial wave function, simplified)
 */
export function hydrogenAtom(
  n: number,
  l: number
): { energy: number; a0: number; psi_radial: (r: number) => number } {
  const a0 = (4 * Math.PI * 8.854187817e-12 * hbar * hbar) / (m_e * e * e); // Bohr radius

  const energy = -13.6 * e / (n * n); // Energy in Joules

  // Simplified radial wave function (n=1, l=0)
  const psi_radial = (r: number) => {
    if (n === 1 && l === 0) {
      return 2 * Math.pow(1 / a0, 1.5) * Math.exp(-r / a0);
    }

    // Higher states would require Laguerre polynomials
    return 0;
  };

  return { energy, a0, psi_radial };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNCERTAINTY PRINCIPLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Heisenberg uncertainty principle: Δx Δp ≥ ℏ/2
 */
export function uncertaintyPrinciple(
  psi: WaveFunction,
  xMin: number,
  xMax: number,
  mass: number = m_e
): { deltaX: number; deltaP: number; product: number; satisfies: boolean } {
  // Compute ⟨x⟩
  const xOp = positionOperator;
  const x_avg = expectationValue(psi, xOp, xMin, xMax);

  // Compute ⟨x²⟩
  const x2Op = (psi: WaveFunction) => {
    return (x: number) => {
      const { real, imag } = psi(x);
      return { real: x * x * real, imag: x * x * imag };
    };
  };
  const x2_avg = expectationValue(psi, x2Op, xMin, xMax);

  // Δx = √(⟨x²⟩ - ⟨x⟩²)
  const deltaX = Math.sqrt(x2_avg - x_avg * x_avg);

  // Compute ⟨p⟩
  const pOp = (psi: WaveFunction) => momentumOperator(psi);
  const p_avg = expectationValue(psi, pOp, xMin, xMax);

  // Compute ⟨p²⟩ (more complex, use kinetic energy relation)
  const p2_avg = 2 * mass * expectationValue(psi, (p) => kineticEnergyOperator(p, mass), xMin, xMax);

  // Δp = √(⟨p²⟩ - ⟨p⟩²)
  const deltaP = Math.sqrt(Math.abs(p2_avg - p_avg * p_avg));

  const product = deltaX * deltaP;
  const satisfies = product >= hbar / 2;

  return { deltaX, deltaP, product, satisfies };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIME EVOLUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Time evolution of eigenstate: ψ(x,t) = ψ(x) exp(-iEt/ℏ)
 */
export function timeEvolution(
  psi: WaveFunction,
  energy: number
): (x: number, t: number) => { real: number; imag: number } {
  return (x: number, t: number) => {
    const { real, imag } = psi(x);
    const phase = (-energy * t) / hbar;

    // exp(-iEt/ℏ) = cos(Et/ℏ) - i sin(Et/ℏ)
    const cosPhase = Math.cos(phase);
    const sinPhase = Math.sin(phase);

    return {
      real: real * cosPhase - imag * sinPhase,
      imag: real * sinPhase + imag * cosPhase,
    };
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUANTUM PHENOMENA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Tunneling probability (rectangular barrier)
 */
export function tunnelingProbability(
  E: number,
  V0: number,
  L: number,
  mass: number = m_e
): number {
  if (E >= V0) {
    // Over the barrier
    return 1;
  }

  const kappa = Math.sqrt((2 * mass * (V0 - E)) / (hbar * hbar));
  const transmission = 1 / (1 + (V0 * V0 * Math.sinh(kappa * L) ** 2) / (4 * E * (V0 - E)));

  return transmission;
}

/**
 * Photoelectric effect
 */
export function photoelectricEffect(
  wavelength: number,
  workFunction: number
): { kineticEnergy: number; stoppingVoltage: number; canEject: boolean } {
  const frequency = c / wavelength;
  const photonEnergy = h * frequency;

  const kineticEnergy = photonEnergy - workFunction;
  const canEject = kineticEnergy > 0;
  const stoppingVoltage = canEject ? kineticEnergy / e : 0;

  return { kineticEnergy, stoppingVoltage, canEject };
}

/**
 * Compton scattering
 */
export function comptonScattering(
  wavelength: number,
  theta: number
): { wavelengthShift: number; finalWavelength: number; energy: number } {
  const lambdaC = h / (m_e * c); // Compton wavelength

  const wavelengthShift = lambdaC * (1 - Math.cos(theta));
  const finalWavelength = wavelength + wavelengthShift;

  const initialEnergy = (h * c) / wavelength;
  const finalEnergy = (h * c) / finalWavelength;
  const energy = initialEnergy - finalEnergy;

  return { wavelengthShift, finalWavelength, energy };
}

/**
 * De Broglie wavelength
 */
export function deBroglieWavelength(momentum: number): number {
  return h / momentum;
}

/**
 * Bohr model
 */
export function bohrModel(n: number): {
  radius: number;
  energy: number;
  velocity: number;
  frequency: number;
} {
  const a0 = (4 * Math.PI * 8.854187817e-12 * hbar * hbar) / (m_e * e * e);

  const radius = n * n * a0;
  const energy = -13.6 * e / (n * n);
  const velocity = e * e / (4 * Math.PI * 8.854187817e-12 * 2 * hbar * n);
  const frequency = Math.abs(energy) / (h * n ** 3);

  return { radius, energy, velocity, frequency };
}

/**
 * Rydberg formula (hydrogen spectral lines)
 */
export function rydbergFormula(n1: number, n2: number): {
  wavelength: number;
  frequency: number;
  energy: number;
  series: string;
} {
  const R = 1.0973731568160e7; // Rydberg constant (m^-1)

  const wavelength = 1 / (R * (1 / (n1 * n1) - 1 / (n2 * n2)));
  const frequency = c / wavelength;
  const energy = h * frequency;

  let series: string;
  if (n1 === 1) series = 'Lyman';
  else if (n1 === 2) series = 'Balmer';
  else if (n1 === 3) series = 'Paschen';
  else if (n1 === 4) series = 'Brackett';
  else series = 'Pfund';

  return { wavelength, frequency, energy, series };
}
