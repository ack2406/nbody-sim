// returns a random float in [min, max) using math.random()
export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// returns a random float from normal distribution using box-muller transform
export function randNormal(mean: number, stdDev: number) {
  const u1 = Math.random();
  const u2 = Math.random();
  // box-muller transform
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

// returns a random float from a normal distribution, clamped to [minVal, maxVal]
export function randNormalClamped(
  mean: number,
  stdDev: number,
  minVal: number,
  maxVal: number
) {
  let val = randNormal(mean, stdDev);
  if (val < minVal) val = minVal;
  if (val > maxVal) val = maxVal;
  return val;
}
