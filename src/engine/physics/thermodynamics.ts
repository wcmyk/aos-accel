/**
 * Thermodynamics & Statistical Mechanics
 * Features:
 * - State equations (ideal gas, van der Waals, etc.)
 * - Thermodynamic processes
 * - Heat engines and efficiency
 * - Statistical distributions
 * - Phase transitions
 */

import { Vector } from '../types-advanced';
import { createVector } from '../math/linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHYSICAL CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const R = 8.314462618; // Universal gas constant (J/(mol·K))
export const k_B = 1.380649e-23; // Boltzmann constant (J/K)
export const N_A = 6.02214076e23; // Avogadro's number
export const sigma = 5.670374419e-8; // Stefan-Boltzmann constant (W/(m²·K⁴))

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EQUATIONS OF STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Ideal gas law: PV = nRT
 */
export function idealGasLaw(params: {
  P?: number;
  V?: number;
  n?: number;
  T?: number;
}): { P: number; V: number; n: number; T: number } {
  const { P, V, n, T } = params;

  // Solve for missing variable
  if (P === undefined && V && n && T) {
    return { P: (n * R * T) / V, V, n, T };
  } else if (V === undefined && P && n && T) {
    return { P, V: (n * R * T) / P, n, T };
  } else if (n === undefined && P && V && T) {
    return { P, V, n: (P * V) / (R * T), T };
  } else if (T === undefined && P && V && n) {
    return { P, V, n, T: (P * V) / (n * R) };
  }

  throw new Error('Exactly one parameter must be undefined');
}

/**
 * Van der Waals equation: (P + a·n²/V²)(V - nb) = nRT
 */
export function vanDerWaalsEquation(
  params: { P?: number; V?: number; n: number; T: number },
  a: number,
  b: number
): { P: number; V: number } {
  const { P, V, n, T } = params;

  if (P === undefined && V) {
    // Solve for P
    const P_calc = (n * R * T) / (V - n * b) - (a * n * n) / (V * V);
    return { P: P_calc, V };
  } else if (V === undefined && P) {
    // Solve for V (cubic equation - use iterative method)
    let V_guess = (n * R * T) / P; // Start with ideal gas

    for (let i = 0; i < 100; i++) {
      const f = (P + (a * n * n) / (V_guess * V_guess)) * (V_guess - n * b) - n * R * T;
      const df =
        (P + (a * n * n) / (V_guess * V_guess)) -
        (2 * a * n * n * (V_guess - n * b)) / (V_guess ** 3);

      const V_new = V_guess - f / df;

      if (Math.abs(V_new - V_guess) < 1e-10) {
        return { P, V: V_new };
      }

      V_guess = V_new;
    }

    throw new Error('Van der Waals equation did not converge');
  }

  throw new Error('Either P or V must be undefined');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THERMODYNAMIC PROPERTIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Internal energy of ideal gas: U = (f/2) nRT
 */
export function internalEnergy(
  n: number,
  T: number,
  degreesOfFreedom: number = 3
): number {
  return (degreesOfFreedom / 2) * n * R * T;
}

/**
 * Heat capacity at constant volume: C_V = (f/2) nR
 */
export function heatCapacityConstantVolume(
  n: number,
  degreesOfFreedom: number = 3
): number {
  return (degreesOfFreedom / 2) * n * R;
}

/**
 * Heat capacity at constant pressure: C_P = C_V + nR
 */
export function heatCapacityConstantPressure(
  n: number,
  degreesOfFreedom: number = 3
): number {
  return heatCapacityConstantVolume(n, degreesOfFreedom) + n * R;
}

/**
 * Heat capacity ratio: γ = C_P / C_V
 */
export function heatCapacityRatio(degreesOfFreedom: number = 3): number {
  return 1 + 2 / degreesOfFreedom;
}

/**
 * Entropy of ideal gas: S = nC_V ln(T) + nR ln(V) + S_0
 */
export function entropy(
  n: number,
  T: number,
  V: number,
  degreesOfFreedom: number = 3,
  S0: number = 0
): number {
  const C_V = heatCapacityConstantVolume(n, degreesOfFreedom);
  return C_V * Math.log(T) + n * R * Math.log(V) + S0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THERMODYNAMIC PROCESSES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ProcessResult {
  finalState: { P: number; V: number; T: number };
  work: number;
  heat: number;
  deltaU: number;
}

/**
 * Isothermal process (constant temperature): PV = constant
 */
export function isothermalProcess(
  n: number,
  T: number,
  V1: number,
  V2: number
): ProcessResult {
  const P1 = (n * R * T) / V1;
  const P2 = (n * R * T) / V2;

  const work = n * R * T * Math.log(V2 / V1);
  const deltaU = 0; // Temperature constant
  const heat = work; // First law: Q = ΔU + W

  return {
    finalState: { P: P2, V: V2, T },
    work,
    heat,
    deltaU,
  };
}

/**
 * Adiabatic process (no heat transfer): PV^γ = constant
 */
export function adiabaticProcess(
  n: number,
  T1: number,
  V1: number,
  V2: number,
  gamma: number
): ProcessResult {
  const P1 = (n * R * T1) / V1;

  // Adiabatic relations
  const T2 = T1 * Math.pow(V1 / V2, gamma - 1);
  const P2 = P1 * Math.pow(V1 / V2, gamma);

  const C_V = (n * R) / (gamma - 1);
  const deltaU = C_V * (T2 - T1);
  const work = -deltaU; // Q = 0, so W = -ΔU
  const heat = 0;

  return {
    finalState: { P: P2, V: V2, T: T2 },
    work,
    heat,
    deltaU,
  };
}

/**
 * Isobaric process (constant pressure)
 */
export function isobaricProcess(
  n: number,
  P: number,
  T1: number,
  T2: number,
  gamma: number
): ProcessResult {
  const V1 = (n * R * T1) / P;
  const V2 = (n * R * T2) / P;

  const work = P * (V2 - V1);
  const C_P = (n * R * gamma) / (gamma - 1);
  const heat = C_P * (T2 - T1);
  const deltaU = heat - work;

  return {
    finalState: { P, V: V2, T: T2 },
    work,
    heat,
    deltaU,
  };
}

/**
 * Isochoric process (constant volume)
 */
export function isochoricProcess(
  n: number,
  V: number,
  T1: number,
  T2: number,
  gamma: number
): ProcessResult {
  const P1 = (n * R * T1) / V;
  const P2 = (n * R * T2) / V;

  const work = 0; // No volume change
  const C_V = (n * R) / (gamma - 1);
  const heat = C_V * (T2 - T1);
  const deltaU = heat;

  return {
    finalState: { P: P2, V, T: T2 },
    work,
    heat,
    deltaU,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEAT ENGINES & CYCLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Carnot cycle efficiency
 */
export function carnotEfficiency(T_hot: number, T_cold: number): {
  efficiency: number;
  COP_refrigerator: number;
  COP_heatPump: number;
} {
  const efficiency = 1 - T_cold / T_hot;
  const COP_refrigerator = T_cold / (T_hot - T_cold);
  const COP_heatPump = T_hot / (T_hot - T_cold);

  return { efficiency, COP_refrigerator, COP_heatPump };
}

/**
 * Otto cycle (gasoline engine)
 */
export function ottoCycle(
  compressionRatio: number,
  gamma: number
): { efficiency: number } {
  const r = compressionRatio;
  const efficiency = 1 - Math.pow(r, 1 - gamma);

  return { efficiency };
}

/**
 * Diesel cycle
 */
export function dieselCycle(
  compressionRatio: number,
  cutoffRatio: number,
  gamma: number
): { efficiency: number } {
  const r = compressionRatio;
  const rc = cutoffRatio;

  const efficiency =
    1 - (1 / Math.pow(r, gamma - 1)) * ((Math.pow(rc, gamma) - 1) / (gamma * (rc - 1)));

  return { efficiency };
}

/**
 * Actual heat engine efficiency
 */
export function heatEngineEfficiency(Q_in: number, Q_out: number): {
  efficiency: number;
  work: number;
} {
  const work = Q_in - Q_out;
  const efficiency = work / Q_in;

  return { efficiency, work };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATISTICAL MECHANICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Maxwell-Boltzmann speed distribution
 */
export function maxwellBoltzmannDistribution(
  mass: number,
  T: number
): {
  vMostProbable: number;
  vAverage: number;
  vRMS: number;
  distribution: (v: number) => number;
} {
  const vMostProbable = Math.sqrt((2 * k_B * T) / mass);
  const vAverage = Math.sqrt((8 * k_B * T) / (Math.PI * mass));
  const vRMS = Math.sqrt((3 * k_B * T) / mass);

  const distribution = (v: number) => {
    const A = 4 * Math.PI * Math.pow(mass / (2 * Math.PI * k_B * T), 1.5);
    return A * v * v * Math.exp((-mass * v * v) / (2 * k_B * T));
  };

  return { vMostProbable, vAverage, vRMS, distribution };
}

/**
 * Boltzmann factor: exp(-E/k_B T)
 */
export function boltzmannFactor(energy: number, T: number): number {
  return Math.exp(-energy / (k_B * T));
}

/**
 * Partition function (discrete states)
 */
export function partitionFunction(energies: number[], T: number): number {
  let Z = 0;
  for (const E of energies) {
    Z += boltzmannFactor(E, T);
  }
  return Z;
}

/**
 * Boltzmann distribution (probability of state)
 */
export function boltzmannDistribution(
  energy: number,
  energies: number[],
  T: number
): number {
  const Z = partitionFunction(energies, T);
  return boltzmannFactor(energy, T) / Z;
}

/**
 * Mean free path: λ = 1/(√2 π d² n)
 */
export function meanFreePath(
  diameter: number,
  numberDensity: number
): number {
  return 1 / (Math.sqrt(2) * Math.PI * diameter * diameter * numberDensity);
}

/**
 * Collision frequency: f = v_avg / λ
 */
export function collisionFrequency(
  v_avg: number,
  meanFreePath: number
): number {
  return v_avg / meanFreePath;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE TRANSITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Clausius-Clapeyron equation (vapor pressure)
 */
export function clausiusClapeyron(
  P1: number,
  T1: number,
  T2: number,
  L: number
): number {
  // P2/P1 = exp(L/R * (1/T1 - 1/T2))
  return P1 * Math.exp((L / R) * (1 / T1 - 1 / T2));
}

/**
 * Latent heat
 */
export function latentHeat(mass: number, L: number): number {
  return mass * L;
}

/**
 * Heat required for temperature change
 */
export function heatTransfer(
  mass: number,
  specificHeat: number,
  deltaT: number
): number {
  return mass * specificHeat * deltaT;
}

/**
 * Heat required including phase change
 */
export function totalHeatTransfer(
  mass: number,
  c1: number,
  T1: number,
  T_transition: number,
  L: number,
  c2: number,
  T2: number
): { heating1: number; phaseChange: number; heating2: number; total: number } {
  const heating1 = mass * c1 * (T_transition - T1);
  const phaseChange = mass * L;
  const heating2 = mass * c2 * (T2 - T_transition);
  const total = heating1 + phaseChange + heating2;

  return { heating1, phaseChange, heating2, total };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEAT TRANSFER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Conduction: Q/t = k A ΔT / d
 */
export function thermalConduction(
  k: number,
  area: number,
  deltaT: number,
  thickness: number
): number {
  return (k * area * deltaT) / thickness;
}

/**
 * Convection: Q/t = h A ΔT
 */
export function thermalConvection(
  h: number,
  area: number,
  deltaT: number
): number {
  return h * area * deltaT;
}

/**
 * Radiation (Stefan-Boltzmann): P = ε σ A T⁴
 */
export function thermalRadiation(
  emissivity: number,
  area: number,
  T: number
): number {
  return emissivity * sigma * area * Math.pow(T, 4);
}

/**
 * Net radiation between two surfaces
 */
export function netRadiation(
  emissivity: number,
  area: number,
  T1: number,
  T2: number
): number {
  return emissivity * sigma * area * (Math.pow(T1, 4) - Math.pow(T2, 4));
}

/**
 * Thermal resistance (R-value)
 */
export function thermalResistance(thickness: number, k: number): number {
  return thickness / k;
}

/**
 * Overall heat transfer coefficient
 */
export function overallHeatTransfer(resistances: number[]): number {
  const totalR = resistances.reduce((sum, R) => sum + R, 0);
  return 1 / totalR;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THERMODYNAMIC RELATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Gibbs free energy: G = H - TS
 */
export function gibbsFreeEnergy(H: number, T: number, S: number): number {
  return H - T * S;
}

/**
 * Helmholtz free energy: F = U - TS
 */
export function helmholtzFreeEnergy(U: number, T: number, S: number): number {
  return U - T * S;
}

/**
 * Enthalpy: H = U + PV
 */
export function enthalpy(U: number, P: number, V: number): number {
  return U + P * V;
}

/**
 * Chemical potential (ideal gas)
 */
export function chemicalPotential(
  T: number,
  P: number,
  mu0: number
): number {
  return mu0 + R * T * Math.log(P);
}

/**
 * Gibbs phase rule: F = C - P + 2
 */
export function gibbsPhaseRule(
  components: number,
  phases: number
): number {
  return components - phases + 2;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPECIAL TOPICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Blackbody radiation (Planck's law)
 */
export function planckLaw(
  wavelength: number,
  T: number
): { spectralRadiance: number; peakWavelength: number } {
  const h = 6.62607015e-34;
  const c = 299792458;

  const numerator = 2 * h * c * c / Math.pow(wavelength, 5);
  const denominator = Math.exp((h * c) / (wavelength * k_B * T)) - 1;

  const spectralRadiance = numerator / denominator;

  // Wien's displacement law
  const peakWavelength = 2.897771955e-3 / T;

  return { spectralRadiance, peakWavelength };
}

/**
 * Joule-Thomson coefficient
 */
export function jouleThomsonCoefficient(
  C_P: number,
  V: number,
  T: number,
  alpha: number
): number {
  // μ_JT = (V/C_P)(T α - 1)
  return (V / C_P) * (T * alpha - 1);
}

/**
 * Compressibility factor: Z = PV/(nRT)
 */
export function compressibilityFactor(P: number, V: number, n: number, T: number): number {
  return (P * V) / (n * R * T);
}
