/**
 * Waves & Optics
 * Features:
 * - Wave propagation
 * - Interference and diffraction
 * - Fourier analysis
 * - Electromagnetic waves
 */

import { Vector, Matrix } from '../types-advanced';
import { createVector, createMatrix } from '../math/linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WAVE BASICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface WaveParams {
  amplitude: number;
  wavelength: number;
  frequency?: number;
  speed?: number;
  phase?: number;
}

/**
 * Wave properties
 */
export function waveProperties(params: WaveParams): {
  k: number;
  omega: number;
  period: number;
  frequency: number;
} {
  const { wavelength, frequency, speed = 343 } = params;

  const k = (2 * Math.PI) / wavelength;
  const f = frequency || speed / wavelength;
  const omega = 2 * Math.PI * f;
  const period = 1 / f;

  return { k, omega, period, frequency: f };
}

/**
 * Traveling wave: y(x,t) = A sin(kx - ωt + φ)
 */
export function travelingWave(params: WaveParams): (x: number, t: number) => number {
  const { amplitude, phase = 0 } = params;
  const { k, omega } = waveProperties(params);

  return (x: number, t: number) => {
    return amplitude * Math.sin(k * x - omega * t + phase);
  };
}

/**
 * Standing wave: y(x,t) = 2A sin(kx) cos(ωt)
 */
export function standingWave(params: WaveParams): (x: number, t: number) => number {
  const { amplitude } = params;
  const { k, omega } = waveProperties(params);

  return (x: number, t: number) => {
    return 2 * amplitude * Math.sin(k * x) * Math.cos(omega * t);
  };
}

/**
 * Wave energy density: u = ½ρω²A²
 */
export function waveEnergyDensity(
  rho: number,
  omega: number,
  amplitude: number
): number {
  return 0.5 * rho * omega * omega * amplitude * amplitude;
}

/**
 * Wave power: P = ½ρvω²A²
 */
export function wavePower(
  rho: number,
  v: number,
  omega: number,
  amplitude: number
): number {
  return 0.5 * rho * v * omega * omega * amplitude * amplitude;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERFERENCE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Two-source interference pattern
 */
export function twoSourceInterference(
  params1: WaveParams,
  params2: WaveParams,
  x1: number,
  x2: number
): (x: number, t: number) => { amplitude: number; intensity: number; type: 'constructive' | 'destructive' | 'intermediate' } {
  const wave1 = travelingWave(params1);
  const wave2 = travelingWave(params2);

  return (x: number, t: number) => {
    const r1 = Math.abs(x - x1);
    const r2 = Math.abs(x - x2);

    const y1 = wave1(r1, t);
    const y2 = wave2(r2, t);

    const y = y1 + y2;
    const amplitude = Math.abs(y);
    const intensity = amplitude * amplitude;

    // Path difference
    const pathDiff = Math.abs(r1 - r2);
    const lambda = params1.wavelength;

    let type: 'constructive' | 'destructive' | 'intermediate';
    if (Math.abs(pathDiff % lambda) < 0.1 * lambda) {
      type = 'constructive';
    } else if (Math.abs((pathDiff % lambda) - lambda / 2) < 0.1 * lambda) {
      type = 'destructive';
    } else {
      type = 'intermediate';
    }

    return { amplitude, intensity, type };
  };
}

/**
 * Young's double slit
 */
export function youngDoubleSlit(
  wavelength: number,
  slitSeparation: number,
  screenDistance: number
): {
  fringeSpacing: number;
  intensity: (y: number) => number;
  order: (y: number) => number;
} {
  const d = slitSeparation;
  const L = screenDistance;
  const lambda = wavelength;

  const fringeSpacing = (lambda * L) / d;

  const intensity = (y: number) => {
    const delta = (d * y) / L;
    const phase = (2 * Math.PI * delta) / lambda;
    return Math.cos(phase / 2) ** 2;
  };

  const order = (y: number) => {
    const delta = (d * y) / L;
    return delta / lambda;
  };

  return { fringeSpacing, intensity, order };
}

/**
 * Thin film interference
 */
export function thinFilmInterference(
  n1: number,
  n2: number,
  n3: number,
  thickness: number,
  wavelength: number,
  incidentAngle: number = 0
): { constructive: boolean; order: number; color: string } {
  // Snell's law for refraction angle
  const theta2 = Math.asin((n1 * Math.sin(incidentAngle)) / n2);

  // Optical path difference
  const opticalPathDiff = 2 * n2 * thickness * Math.cos(theta2);

  // Phase change on reflection?
  const phaseChange = n2 > n1 ? Math.PI : 0;

  // Total phase difference
  const totalPhase = (2 * Math.PI * opticalPathDiff) / wavelength + phaseChange;

  // Order of interference
  const order = totalPhase / (2 * Math.PI);

  // Constructive or destructive?
  const constructive = Math.abs(totalPhase % (2 * Math.PI)) < Math.PI / 2;

  // Wavelength-dependent color (simplified)
  let color: string;
  if (wavelength < 450e-9) color = 'violet';
  else if (wavelength < 500e-9) color = 'blue';
  else if (wavelength < 570e-9) color = 'green';
  else if (wavelength < 590e-9) color = 'yellow';
  else if (wavelength < 620e-9) color = 'orange';
  else color = 'red';

  return { constructive, order, color };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DIFFRACTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Single slit diffraction
 */
export function singleSlitDiffraction(
  wavelength: number,
  slitWidth: number,
  screenDistance: number
): {
  minima: (order: number) => number;
  intensity: (theta: number) => number;
  centralMaxWidth: number;
} {
  const a = slitWidth;
  const lambda = wavelength;
  const L = screenDistance;

  const minima = (order: number) => {
    const theta = Math.asin((order * lambda) / a);
    return L * Math.tan(theta);
  };

  const intensity = (theta: number) => {
    const beta = (Math.PI * a * Math.sin(theta)) / lambda;
    if (Math.abs(beta) < 1e-10) return 1;
    return (Math.sin(beta) / beta) ** 2;
  };

  const centralMaxWidth = 2 * minima(1);

  return { minima, intensity, centralMaxWidth };
}

/**
 * Diffraction grating
 */
export function diffractionGrating(
  wavelength: number,
  gratingSpacing: number,
  numSlits: number
): {
  maxima: (order: number) => number;
  intensity: (theta: number) => number;
  resolution: number;
} {
  const d = gratingSpacing;
  const lambda = wavelength;
  const N = numSlits;

  const maxima = (order: number) => {
    return Math.asin((order * lambda) / d);
  };

  const intensity = (theta: number) => {
    const delta = (2 * Math.PI * d * Math.sin(theta)) / lambda;
    const numerator = Math.sin((N * delta) / 2);
    const denominator = Math.sin(delta / 2);

    if (Math.abs(denominator) < 1e-10) return N * N;

    return (numerator / denominator) ** 2;
  };

  // Chromatic resolving power: R = mN
  const resolution = N;

  return { maxima, intensity, resolution };
}

/**
 * Circular aperture (Airy disk)
 */
export function airyDisk(
  wavelength: number,
  apertureDiameter: number,
  focalLength: number
): {
  firstMinimum: number;
  angularResolution: number;
  intensity: (r: number) => number;
} {
  const D = apertureDiameter;
  const lambda = wavelength;
  const f = focalLength;

  // Rayleigh criterion
  const angularResolution = 1.22 * lambda / D;
  const firstMinimum = 1.22 * lambda * f / D;

  const intensity = (r: number) => {
    const x = (Math.PI * D * r) / (lambda * f);
    if (Math.abs(x) < 1e-10) return 1;

    // Bessel function J1(x) approximation
    const j1 = (x: number) => {
      return (x / 2) * (1 - x * x / 8 + x ** 4 / 192);
    };

    return (2 * j1(x) / x) ** 2;
  };

  return { firstMinimum, angularResolution, intensity };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOURIER ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface FourierComponent {
  amplitude: number;
  frequency: number;
  phase: number;
}

/**
 * Discrete Fourier Transform (simplified, real-valued)
 */
export function dft(signal: number[]): FourierComponent[] {
  const N = signal.length;
  const components: FourierComponent[] = [];

  for (let k = 0; k < N / 2; k++) {
    let realPart = 0;
    let imagPart = 0;

    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      realPart += signal[n] * Math.cos(angle);
      imagPart -= signal[n] * Math.sin(angle);
    }

    const amplitude = Math.sqrt(realPart * realPart + imagPart * imagPart) / N;
    const phase = Math.atan2(imagPart, realPart);

    components.push({
      amplitude: 2 * amplitude, // Factor of 2 for one-sided spectrum
      frequency: k,
      phase,
    });
  }

  return components;
}

/**
 * Inverse DFT (reconstruct signal from Fourier components)
 */
export function idft(components: FourierComponent[], N: number): number[] {
  const signal = new Array(N).fill(0);

  for (let n = 0; n < N; n++) {
    for (let k = 0; k < components.length; k++) {
      const { amplitude, frequency, phase } = components[k];
      const angle = (2 * Math.PI * frequency * n) / N + phase;
      signal[n] += amplitude * Math.cos(angle);
    }
  }

  return signal;
}

/**
 * Power spectrum (frequency domain energy)
 */
export function powerSpectrum(signal: number[]): { frequencies: number[]; power: number[] } {
  const components = dft(signal);
  const frequencies = components.map((c) => c.frequency);
  const power = components.map((c) => c.amplitude * c.amplitude);

  return { frequencies, power };
}

/**
 * Synthesize wave from harmonics
 */
export function fourierSeries(
  harmonics: { amplitude: number; n: number; phase: number }[],
  fundamentalFreq: number
): (t: number) => number {
  return (t: number) => {
    let sum = 0;
    for (const h of harmonics) {
      sum += h.amplitude * Math.sin(2 * Math.PI * h.n * fundamentalFreq * t + h.phase);
    }
    return sum;
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELECTROMAGNETIC WAVES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const c = 299792458; // Speed of light (m/s)
const epsilon0 = 8.854187817e-12; // Permittivity of free space
const mu0 = 1.25663706212e-6; // Permeability of free space

/**
 * EM wave in vacuum
 */
export function emWave(
  E0: number,
  frequency: number,
  direction: Vector
): {
  wavelength: number;
  omega: number;
  k: Vector;
  E: (r: Vector, t: number) => Vector;
  B: (r: Vector, t: number) => Vector;
  intensity: number;
} {
  const omega = 2 * Math.PI * frequency;
  const wavelength = c / frequency;
  const kMag = (2 * Math.PI) / wavelength;

  // Wave vector
  const k = createVector(direction.data.map((d) => kMag * d));

  // Intensity (Poynting vector magnitude)
  const intensity = 0.5 * c * epsilon0 * E0 * E0;

  const E = (r: Vector, t: number) => {
    const kDotR = k.data.reduce((sum, ki, i) => sum + ki * r.data[i], 0);
    const phase = kDotR - omega * t;
    const amplitude = E0 * Math.cos(phase);

    // E field perpendicular to k (assume z-direction for simplicity)
    return createVector([0, 0, amplitude]);
  };

  const B = (r: Vector, t: number) => {
    const kDotR = k.data.reduce((sum, ki, i) => sum + ki * r.data[i], 0);
    const phase = kDotR - omega * t;
    const B0 = E0 / c;
    const amplitude = B0 * Math.cos(phase);

    // B = k × E / c (perpendicular to both k and E)
    return createVector([0, amplitude, 0]);
  };

  return { wavelength, omega, k, E, B, intensity };
}

/**
 * Doppler effect for EM waves
 */
export function dopplerShift(
  frequency: number,
  sourceVelocity: number,
  observerVelocity: number
): { observedFrequency: number; shift: number; redshift: number } {
  // Relativistic Doppler effect
  const beta = (sourceVelocity - observerVelocity) / c;
  const gamma = 1 / Math.sqrt(1 - beta * beta);

  const observedFrequency = frequency * gamma * (1 - beta);
  const shift = observedFrequency - frequency;
  const redshift = (frequency - observedFrequency) / observedFrequency;

  return { observedFrequency, shift, redshift };
}

/**
 * Polarization
 */
export function malusLaw(I0: number, theta: number): number {
  return I0 * Math.cos(theta) ** 2;
}

/**
 * Brewster's angle (polarization by reflection)
 */
export function brewsterAngle(n1: number, n2: number): number {
  return Math.atan(n2 / n1);
}

/**
 * EM spectrum classification
 */
export function emSpectrumClassify(wavelength: number): {
  type: string;
  frequency: number;
  energy: number;
} {
  const h = 6.62607015e-34; // Planck's constant
  const frequency = c / wavelength;
  const energy = h * frequency;

  let type: string;
  if (wavelength > 1e-3) type = 'Radio';
  else if (wavelength > 1e-6) type = 'Microwave';
  else if (wavelength > 7e-7) type = 'Infrared';
  else if (wavelength > 4e-7) type = 'Visible';
  else if (wavelength > 1e-8) type = 'Ultraviolet';
  else if (wavelength > 1e-11) type = 'X-ray';
  else type = 'Gamma ray';

  return { type, frequency, energy };
}
