/**
 * Machine Learning Models
 * Features:
 * - Linear regression
 * - Logistic regression
 * - Neural networks (simple feedforward)
 * - Model evaluation metrics
 */

import { Vector, Matrix } from '../types-advanced';
import { createVector, createMatrix, matrixMultiply, transpose, inverse } from '../math/linalg';
import { GradientDescentOptimizer, AdamOptimizer, Optimizer } from './optimizers';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BASE MODEL INTERFACE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Model {
  fit(X: Matrix, y: Vector, options?: FitOptions): TrainingHistory;
  predict(X: Matrix): Vector;
  getParameters(): number[];
  setParameters(params: number[]): void;
}

export interface FitOptions {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  optimizer?: 'sgd' | 'adam';
  verbose?: boolean;
  validationSplit?: number;
}

export interface TrainingHistory {
  loss: number[];
  valLoss?: number[];
  metrics?: Record<string, number[]>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINEAR REGRESSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class LinearRegression implements Model {
  private weights: Vector | null = null;
  private bias: number = 0;
  private regularization: number;

  constructor(regularization: number = 0) {
    this.regularization = regularization;
  }

  /**
   * Fit using normal equation: w = (X^T X + λI)^-1 X^T y
   */
  fit(X: Matrix, y: Vector): TrainingHistory {
    const n = X.rows;
    const d = X.cols;

    // Add bias column (all 1s)
    const XWithBias = this.addBiasColumn(X);

    // Compute X^T X
    const XT = transpose(XWithBias);
    const XTX = matrixMultiply(XT, XWithBias);

    // Add regularization: X^T X + λI
    if (this.regularization > 0) {
      for (let i = 0; i < d + 1; i++) {
        XTX.data[i][i] += this.regularization;
      }
    }

    // Compute (X^T X)^-1
    const XTXInv = inverse(XTX);

    // Compute X^T y
    const XTy = this.matrixVectorMultiply(XT, y);

    // w = (X^T X)^-1 X^T y
    const w = this.matrixVectorMultiply(XTXInv, XTy);

    // Split into weights and bias
    this.weights = createVector(w.data.slice(0, d));
    this.bias = w.data[d];

    // Compute final loss
    const predictions = this.predict(X);
    const loss = this.computeMSE(y, predictions);

    return { loss: [loss] };
  }

  predict(X: Matrix): Vector {
    if (!this.weights) {
      throw new Error('Model not fitted yet');
    }

    const predictions = new Array(X.rows);

    for (let i = 0; i < X.rows; i++) {
      let sum = this.bias;
      for (let j = 0; j < X.cols; j++) {
        sum += X.data[i][j] * this.weights.data[j];
      }
      predictions[i] = sum;
    }

    return createVector(predictions);
  }

  getParameters(): number[] {
    if (!this.weights) return [];
    return [...this.weights.data, this.bias];
  }

  setParameters(params: number[]): void {
    this.bias = params[params.length - 1];
    this.weights = createVector(params.slice(0, -1));
  }

  private addBiasColumn(X: Matrix): Matrix {
    const data = X.data.map((row) => [...row, 1]);
    return createMatrix(data);
  }

  private matrixVectorMultiply(A: Matrix, v: Vector): Vector {
    const result = new Array(A.rows).fill(0);

    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        result[i] += A.data[i][j] * v.data[j];
      }
    }

    return createVector(result);
  }

  private computeMSE(yTrue: Vector, yPred: Vector): number {
    let sum = 0;
    for (let i = 0; i < yTrue.length; i++) {
      const diff = yTrue.data[i] - yPred.data[i];
      sum += diff * diff;
    }
    return sum / yTrue.length;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGISTIC REGRESSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class LogisticRegression implements Model {
  private weights: Vector | null = null;
  private bias: number = 0;
  private regularization: number;

  constructor(regularization: number = 0) {
    this.regularization = regularization;
  }

  /**
   * Fit using gradient descent
   */
  fit(X: Matrix, y: Vector, options: FitOptions = {}): TrainingHistory {
    const {
      epochs = 100,
      learningRate = 0.01,
      optimizer = 'adam',
      verbose = false,
    } = options;

    const n = X.rows;
    const d = X.cols;

    // Initialize weights
    this.weights = createVector(new Array(d).fill(0));
    this.bias = 0;

    // Create optimizer
    const opt = optimizer === 'adam'
      ? new AdamOptimizer(learningRate)
      : new GradientDescentOptimizer(learningRate);

    const history: TrainingHistory = { loss: [] };

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Forward pass
      const predictions = this.predict(X);

      // Compute loss
      const loss = this.computeBinaryCrossEntropy(y, predictions);
      history.loss.push(loss);

      // Compute gradients
      const { weightGrads, biasGrad } = this.computeGradients(X, y, predictions);

      // Add regularization
      if (this.regularization > 0) {
        for (let j = 0; j < d; j++) {
          weightGrads.data[j] += this.regularization * this.weights!.data[j];
        }
      }

      // Update parameters
      const params = [...this.weights.data, this.bias];
      const grads = [...weightGrads.data, biasGrad];

      const updated = opt.update(params, grads);

      this.weights = createVector(updated.slice(0, d));
      this.bias = updated[d];

      if (verbose && epoch % 10 === 0) {
        console.log(`Epoch ${epoch}: Loss = ${loss.toFixed(4)}`);
      }
    }

    return history;
  }

  predict(X: Matrix): Vector {
    if (!this.weights) {
      throw new Error('Model not fitted yet');
    }

    const predictions = new Array(X.rows);

    for (let i = 0; i < X.rows; i++) {
      let z = this.bias;
      for (let j = 0; j < X.cols; j++) {
        z += X.data[i][j] * this.weights.data[j];
      }
      predictions[i] = this.sigmoid(z);
    }

    return createVector(predictions);
  }

  predictClass(X: Matrix, threshold: number = 0.5): number[] {
    const probs = this.predict(X);
    return probs.data.map((p) => (p >= threshold ? 1 : 0));
  }

  getParameters(): number[] {
    if (!this.weights) return [];
    return [...this.weights.data, this.bias];
  }

  setParameters(params: number[]): void {
    this.bias = params[params.length - 1];
    this.weights = createVector(params.slice(0, -1));
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  private computeBinaryCrossEntropy(yTrue: Vector, yPred: Vector): number {
    let sum = 0;
    const eps = 1e-7;

    for (let i = 0; i < yTrue.length; i++) {
      const y = yTrue.data[i];
      const p = Math.max(eps, Math.min(1 - eps, yPred.data[i]));
      sum -= y * Math.log(p) + (1 - y) * Math.log(1 - p);
    }

    return sum / yTrue.length;
  }

  private computeGradients(
    X: Matrix,
    yTrue: Vector,
    yPred: Vector
  ): { weightGrads: Vector; biasGrad: number } {
    const n = X.rows;
    const d = X.cols;

    const weightGrads = new Array(d).fill(0);
    let biasGrad = 0;

    for (let i = 0; i < n; i++) {
      const error = yPred.data[i] - yTrue.data[i];

      for (let j = 0; j < d; j++) {
        weightGrads[j] += error * X.data[i][j];
      }

      biasGrad += error;
    }

    return {
      weightGrads: createVector(weightGrads.map((g) => g / n)),
      biasGrad: biasGrad / n,
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEURAL NETWORK (Simple Feedforward)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ActivationFunction = 'relu' | 'sigmoid' | 'tanh' | 'linear';

export interface Layer {
  weights: Matrix;
  bias: Vector;
  activation: ActivationFunction;
}

export class NeuralNetwork implements Model {
  private layers: Layer[] = [];
  private architecture: number[];

  constructor(architecture: number[], activation: ActivationFunction = 'relu') {
    this.architecture = architecture;

    // Initialize layers
    for (let i = 0; i < architecture.length - 1; i++) {
      const inputSize = architecture[i];
      const outputSize = architecture[i + 1];

      // Xavier initialization
      const scale = Math.sqrt(2 / (inputSize + outputSize));
      const weights = createMatrix(
        Array.from({ length: outputSize }, () =>
          Array.from({ length: inputSize }, () => (Math.random() - 0.5) * 2 * scale)
        )
      );

      const bias = createVector(new Array(outputSize).fill(0));

      this.layers.push({
        weights,
        bias,
        activation: i === architecture.length - 2 ? 'linear' : activation,
      });
    }
  }

  fit(X: Matrix, y: Vector, options: FitOptions = {}): TrainingHistory {
    const {
      epochs = 100,
      batchSize = 32,
      learningRate = 0.001,
      optimizer = 'adam',
      verbose = false,
      validationSplit = 0,
    } = options;

    // Split data
    const splitIdx = Math.floor(X.rows * (1 - validationSplit));
    const XTrain = this.sliceMatrix(X, 0, splitIdx);
    const yTrain = this.sliceVector(y, 0, splitIdx);
    const XVal = validationSplit > 0 ? this.sliceMatrix(X, splitIdx, X.rows) : null;
    const yVal = validationSplit > 0 ? this.sliceVector(y, splitIdx, y.length) : null;

    // Create optimizer
    const opt = optimizer === 'adam'
      ? new AdamOptimizer(learningRate)
      : new GradientDescentOptimizer(learningRate);

    const history: TrainingHistory = { loss: [], valLoss: [] };

    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;
      const numBatches = Math.ceil(XTrain.rows / batchSize);

      for (let batch = 0; batch < numBatches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, XTrain.rows);

        const XBatch = this.sliceMatrix(XTrain, start, end);
        const yBatch = this.sliceVector(yTrain, start, end);

        // Forward pass
        const { predictions, activations } = this.forwardPass(XBatch);

        // Compute loss
        const loss = this.computeMSE(yBatch, predictions);
        epochLoss += loss;

        // Backward pass
        const gradients = this.backwardPass(XBatch, yBatch, activations);

        // Update parameters
        this.updateParameters(gradients, opt);
      }

      history.loss.push(epochLoss / numBatches);

      // Validation loss
      if (XVal && yVal) {
        const valPred = this.predict(XVal);
        const valLoss = this.computeMSE(yVal, valPred);
        history.valLoss!.push(valLoss);
      }

      if (verbose && epoch % 10 === 0) {
        const msg = `Epoch ${epoch}: Loss = ${history.loss[epoch].toFixed(4)}`;
        console.log(
          history.valLoss?.length
            ? `${msg}, Val Loss = ${history.valLoss[epoch].toFixed(4)}`
            : msg
        );
      }
    }

    return history;
  }

  predict(X: Matrix): Vector {
    const { predictions } = this.forwardPass(X);
    return predictions;
  }

  getParameters(): number[] {
    const params: number[] = [];

    for (const layer of this.layers) {
      // Flatten weights
      for (const row of layer.weights.data) {
        params.push(...row);
      }
      // Add biases
      params.push(...layer.bias.data);
    }

    return params;
  }

  setParameters(params: number[]): void {
    let idx = 0;

    for (const layer of this.layers) {
      // Load weights
      for (let i = 0; i < layer.weights.rows; i++) {
        for (let j = 0; j < layer.weights.cols; j++) {
          layer.weights.data[i][j] = params[idx++];
        }
      }
      // Load biases
      for (let i = 0; i < layer.bias.length; i++) {
        layer.bias.data[i] = params[idx++];
      }
    }
  }

  private forwardPass(X: Matrix): { predictions: Vector; activations: Matrix[] } {
    let activation = X;
    const activations: Matrix[] = [X];

    for (const layer of this.layers) {
      // Linear transformation: a = Wx + b
      const linear = this.linearTransform(activation, layer.weights, layer.bias);

      // Apply activation
      activation = this.applyActivation(linear, layer.activation);
      activations.push(activation);
    }

    // Extract predictions (last layer output)
    const predictions = createVector(activation.data.map((row) => row[0]));

    return { predictions, activations };
  }

  private backwardPass(
    X: Matrix,
    yTrue: Vector,
    activations: Matrix[]
  ): { weightGrads: Matrix[]; biasGrads: Vector[] } {
    const weightGrads: Matrix[] = [];
    const biasGrads: Vector[] = [];

    // Initialize output gradient
    const outputGrad = this.computeOutputGradient(yTrue, activations[activations.length - 1]);

    let delta = outputGrad;

    // Backpropagate through layers
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      const activation = activations[i];

      // Compute gradients for this layer
      const weightGrad = this.computeWeightGradient(delta, activation);
      const biasGrad = this.computeBiasGradient(delta);

      weightGrads.unshift(weightGrad);
      biasGrads.unshift(biasGrad);

      // Backpropagate delta to previous layer
      if (i > 0) {
        delta = this.backpropDelta(delta, layer.weights, activation, layer.activation);
      }
    }

    return { weightGrads, biasGrads };
  }

  private linearTransform(X: Matrix, W: Matrix, b: Vector): Matrix {
    const result = matrixMultiply(X, transpose(W));

    // Add bias
    for (let i = 0; i < result.rows; i++) {
      for (let j = 0; j < result.cols; j++) {
        result.data[i][j] += b.data[j];
      }
    }

    return result;
  }

  private applyActivation(X: Matrix, activation: ActivationFunction): Matrix {
    const result = createMatrix(X.data.map((row) => [...row]));

    for (let i = 0; i < result.rows; i++) {
      for (let j = 0; j < result.cols; j++) {
        result.data[i][j] = this.activationFunction(result.data[i][j], activation);
      }
    }

    return result;
  }

  private activationFunction(x: number, type: ActivationFunction): number {
    switch (type) {
      case 'relu':
        return Math.max(0, x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'tanh':
        return Math.tanh(x);
      case 'linear':
        return x;
    }
  }

  private activationDerivative(x: number, type: ActivationFunction): number {
    switch (type) {
      case 'relu':
        return x > 0 ? 1 : 0;
      case 'sigmoid': {
        const s = this.activationFunction(x, 'sigmoid');
        return s * (1 - s);
      }
      case 'tanh': {
        const t = Math.tanh(x);
        return 1 - t * t;
      }
      case 'linear':
        return 1;
    }
  }

  private computeOutputGradient(yTrue: Vector, yPred: Matrix): Matrix {
    const grad: number[][] = [];

    for (let i = 0; i < yPred.rows; i++) {
      grad.push([yPred.data[i][0] - yTrue.data[i]]);
    }

    return createMatrix(grad);
  }

  private computeWeightGradient(delta: Matrix, activation: Matrix): Matrix {
    return matrixMultiply(transpose(delta), activation);
  }

  private computeBiasGradient(delta: Matrix): Vector {
    const grad = new Array(delta.cols).fill(0);

    for (let i = 0; i < delta.rows; i++) {
      for (let j = 0; j < delta.cols; j++) {
        grad[j] += delta.data[i][j];
      }
    }

    return createVector(grad.map((g) => g / delta.rows));
  }

  private backpropDelta(
    delta: Matrix,
    weights: Matrix,
    _activation: Matrix,
    _activationType: ActivationFunction
  ): Matrix {
    return matrixMultiply(delta, weights);
  }

  private updateParameters(
    gradients: { weightGrads: Matrix[]; biasGrads: Vector[] },
    optimizer: Optimizer
  ): void {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];

      // Update weights
      const weightParams = layer.weights.data.flat();
      const weightGrads = gradients.weightGrads[i].data.flat();
      const updatedWeights = optimizer.update(weightParams, weightGrads);

      let idx = 0;
      for (let r = 0; r < layer.weights.rows; r++) {
        for (let c = 0; c < layer.weights.cols; c++) {
          layer.weights.data[r][c] = updatedWeights[idx++];
        }
      }

      // Update biases
      const updatedBiases = optimizer.update(layer.bias.data, gradients.biasGrads[i].data);
      layer.bias = createVector(updatedBiases);
    }
  }

  private sliceMatrix(X: Matrix, start: number, end: number): Matrix {
    return createMatrix(X.data.slice(start, end));
  }

  private sliceVector(v: Vector, start: number, end: number): Vector {
    return createVector(v.data.slice(start, end));
  }

  private computeMSE(yTrue: Vector, yPred: Vector): number {
    let sum = 0;
    for (let i = 0; i < yTrue.length; i++) {
      const diff = yTrue.data[i] - yPred.data[i];
      sum += diff * diff;
    }
    return sum / yTrue.length;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODEL EVALUATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Mean Squared Error
 */
export function mse(yTrue: Vector, yPred: Vector): number {
  let sum = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const diff = yTrue.data[i] - yPred.data[i];
    sum += diff * diff;
  }
  return sum / yTrue.length;
}

/**
 * Root Mean Squared Error
 */
export function rmse(yTrue: Vector, yPred: Vector): number {
  return Math.sqrt(mse(yTrue, yPred));
}

/**
 * Mean Absolute Error
 */
export function mae(yTrue: Vector, yPred: Vector): number {
  let sum = 0;
  for (let i = 0; i < yTrue.length; i++) {
    sum += Math.abs(yTrue.data[i] - yPred.data[i]);
  }
  return sum / yTrue.length;
}

/**
 * R² Score
 */
export function r2Score(yTrue: Vector, yPred: Vector): number {
  const mean = yTrue.data.reduce((sum, y) => sum + y, 0) / yTrue.length;

  let ssTotal = 0;
  let ssResidual = 0;

  for (let i = 0; i < yTrue.length; i++) {
    ssTotal += (yTrue.data[i] - mean) ** 2;
    ssResidual += (yTrue.data[i] - yPred.data[i]) ** 2;
  }

  return 1 - ssResidual / ssTotal;
}

/**
 * Accuracy (classification)
 */
export function accuracy(yTrue: number[], yPred: number[]): number {
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === yPred[i]) correct++;
  }
  return correct / yTrue.length;
}

/**
 * Confusion matrix
 */
export function confusionMatrix(yTrue: number[], yPred: number[]): number[][] {
  const matrix = [
    [0, 0],
    [0, 0],
  ];

  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i];
    const p = yPred[i];
    matrix[t][p]++;
  }

  return matrix;
}

/**
 * Precision, Recall, F1
 */
export function classificationMetrics(yTrue: number[], yPred: number[]): {
  precision: number;
  recall: number;
  f1: number;
} {
  const cm = confusionMatrix(yTrue, yPred);
  const tp = cm[1][1];
  const fp = cm[0][1];
  const fn = cm[1][0];

  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1 = (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1 };
}
