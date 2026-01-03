# Accel Examples

This document demonstrates Accel's unified spreadsheet + graphing capabilities.

## Example 1: Linear Function with Interactive Parameters

**Demonstrates**: Excel formulas + Desmos graphing + Interactive sliders

### Setup:
1. Set cell **A1** = `2` (make it a parameter: min=0, max=10, step=0.1)
2. Set cell **B1** = `3` (make it a parameter: min=-10, max=10, step=0.1)
3. Add graph: `A1 * x + B1`

### What happens:
- **A1** is the slope
- **B1** is the y-intercept
- The graph shows: `y = 2x + 3`
- **Drag the A1 slider** → slope changes in real-time
- **Drag the B1 slider** → y-intercept changes in real-time
- Graph updates **instantly** (no refresh needed)

---

## Example 2: Trigonometric Functions

**Demonstrates**: Excel math functions + Parametric curves

### Setup:
1. Set cell **A1** = `1` (amplitude, parameter: 0-5, step=0.1)
2. Set cell **B1** = `1` (frequency, parameter: 0-10, step=0.1)
3. Set cell **C1** = `0` (phase shift, parameter: 0-6.28, step=0.1)
4. Add graph: `A1 * SIN(B1 * x + C1)`

### What happens:
- Adjust **A1** to change amplitude
- Adjust **B1** to change frequency
- Adjust **C1** to shift the wave
- All changes reflected in graph **immediately**

---

## Example 3: Quadratic Function

**Demonstrates**: Power functions + Formula composition

### Setup:
1. Set cell **A1** = `1` (a coefficient)
2. Set cell **B1** = `0` (b coefficient)
3. Set cell **C1** = `0` (c coefficient)
4. Add graph: `A1 * POWER(x, 2) + B1 * x + C1`

### What happens:
- Parabola: `y = ax² + bx + c`
- Change **A1** to flip or widen parabola
- Change **B1** and **C1** to move it
- Perfect for teaching algebra!

---

## Example 4: Data Analysis + Visualization

**Demonstrates**: Statistical functions + Live calculation

### Setup:
1. Enter data in column A (rows 1-10)
2. Set cell **B1** = `=AVERAGE(A1:A10)`
3. Set cell **B2** = `=STDEV(A1:A10)`
4. Set cell **B3** = `=MIN(A1:A10)`
5. Set cell **B4** = `=MAX(A1:A10)`
6. Add graph: `B1` (horizontal line showing average)

### What happens:
- Statistics calculated from spreadsheet data
- Change any value in column A → all stats update
- Graph shows reference line

---

## Example 5: Multiple Curves

**Demonstrates**: Multiple graphs on same canvas

### Setup:
1. Set cell **A1** = `1`
2. Add graph 1: `SIN(x)` (red)
3. Add graph 2: `COS(x)` (blue)
4. Add graph 3: `TAN(x)` (green)

### What happens:
- All three trig functions displayed together
- Each with different color
- Can toggle visibility independently

---

## Example 6: Automation - Parameter Sweep

**Demonstrates**: Automation system

### Setup:
1. Set cell **A1** = `0` (parameter: 0-10)
2. Set cell **B1** = `=A1 * 2`
3. Add graph: `SIN(A1 * x)`
4. Run automation: "Parameter Sweep"

### What happens:
- **A1** automatically sweeps from 0 to 10
- **B1** updates as A1 changes
- Graph animates in real-time
- Watch the sine wave frequency increase!

---

## Example 7: Monte Carlo Simulation

**Demonstrates**: Random functions + Automation

### Setup:
1. Set cell **A1** = `=RAND()`
2. Set cell **A2** = `=RAND()`
3. Set cell **A3** = `=A1 + A2`
4. Set cell **A4** = `=AVERAGE(A1:A3)`
5. Run automation: "Monte Carlo Simulation"

### What happens:
- Random values generated continuously
- Statistics update in real-time
- Can add graph to visualize distribution

---

## Example 8: Physics Simulation - Projectile Motion

**Demonstrates**: Complex formulas + Real-world modeling

### Setup:
1. **A1** = `45` (angle in degrees, parameter: 0-90)
2. **A2** = `20` (initial velocity, parameter: 0-50)
3. **A3** = `=RADIANS(A1)` (convert to radians)
4. **A4** = `9.81` (gravity)
5. Add graph: `x * TAN(A3) - (A4 * POWER(x, 2)) / (2 * POWER(A2 * COS(A3), 2))`

### What happens:
- Parabolic trajectory of projectile
- Adjust angle → see how path changes
- Adjust velocity → see how distance changes
- Perfect for physics education!

---

## Example 9: Exponential Growth/Decay

**Demonstrates**: Exponential functions

### Setup:
1. **A1** = `2` (base, parameter: 0.1-5)
2. **A2** = `1` (multiplier, parameter: 0-10)
3. Add graph: `A2 * POWER(A1, x)`

### What happens:
- Exponential growth when A1 > 1
- Exponential decay when 0 < A1 < 1
- Adjust parameters to see different rates

---

## Example 10: Financial Modeling - Compound Interest

**Demonstrates**: Financial functions + Practical application

### Setup:
1. **A1** = `1000` (principal)
2. **A2** = `0.05` (interest rate, parameter: 0-0.2, step=0.01)
3. **A3** = `12` (compounds per year)
4. Add graph: `A1 * POWER(1 + A2/A3, A3 * x)`

### What happens:
- Shows how money grows over time
- Adjust interest rate to see impact
- x-axis = years
- y-axis = total value

---

## Key Principles Demonstrated

All examples show that:

1. **Spreadsheet and graph are ONE thing** - change a cell, graph updates instantly
2. **No mode switching** - formulas and graphs use the same syntax
3. **Parameters are live** - sliders update everything in real-time
4. **Automation works** - can script complex scenarios
5. **Excel + Desmos = Accel** - best of both worlds

This is the **unified computational environment** as specified in the positioning document.
