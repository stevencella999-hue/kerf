/**
 * laser-presets.js
 * Rough starting-point cut settings per laser type, and per-material
 * multipliers applied on top of them. These are NOT calibrated for any
 * specific machine — always run a scrap-material test first.
 */
const LASER_TYPES = {
  co2: {
    name: "CO2",
    hasFrequency: false,
    hasQPulse: false,
    base: { speed: 300, powerMin: 15, powerMax: 60 },
  },
  diode: {
    name: "Diode",
    hasFrequency: false,
    hasQPulse: false,
    base: { speed: 150, powerMin: 20, powerMax: 85 },
  },
  fiber: {
    name: "Fiber",
    hasFrequency: true,
    hasQPulse: false,
    base: { speed: 1000, powerMin: 20, powerMax: 70, frequency: 30 },
  },
  galvo: {
    name: "Galvo",
    hasFrequency: true,
    hasQPulse: true,
    base: { speed: 2000, powerMin: 25, powerMax: 80, frequency: 60, qPulse: 4 },
  },
  uv: {
    name: "UV",
    hasFrequency: true,
    hasQPulse: true,
    base: { speed: 800, powerMin: 10, powerMax: 45, frequency: 40, qPulse: 2 },
  },
};

// Multiplier applied to (speed, powerMax) per material — denser/harder
// materials generally want less power & more speed; soft/porous materials
// the opposite.
const MATERIAL_LASER_FACTOR = {
  wood: { speed: 1.0, power: 1.0 },
  slate: { speed: 0.85, power: 1.1 },
  acrylic: { speed: 1.1, power: 0.8 },
  leather: { speed: 1.15, power: 0.7 },
  cork: { speed: 1.2, power: 0.65 },
  glass: { speed: 0.7, power: 1.15 },
  aluminum: { speed: 0.6, power: 1.3 },
  steel: { speed: 0.5, power: 1.35 },
  tile: { speed: 0.75, power: 1.1 },
  tileBlack: { speed: 0.9, power: 0.95 },
};

function getLaserDefaults(laserKey, materialKey) {
  const laser = LASER_TYPES[laserKey];
  const factor = MATERIAL_LASER_FACTOR[materialKey] || { speed: 1, power: 1 };
  const b = laser.base;
  return {
    speed: Math.round(b.speed * factor.speed),
    powerMin: Math.round(b.powerMin * Math.min(factor.power, 1.05)),
    powerMax: Math.min(100, Math.round(b.powerMax * factor.power)),
    frequency: b.frequency ? Math.round(b.frequency) : null,
    qPulse: b.qPulse || null,
    hasFrequency: laser.hasFrequency,
    hasQPulse: laser.hasQPulse,
  };
}
