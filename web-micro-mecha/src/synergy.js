// Very lightweight synergy check and runtime hooks

// Overheater: requires both 熱 and 連射 across build
export function computeSynergies(pickedTags) {
  const tagSet = new Set(pickedTags);
  return {
    overheater: tagSet.has('熱') && tagSet.has('連射'),
  };
}

export function applySynergyEffects(state, dt) {
  // Overheater: continuous fire increases damage up to +50%
  if (state.synergies.overheater) {
    if (state.combat.firingThisTick) {
      state.combat.overheat = Math.min(5, state.combat.overheat + dt);
    } else {
      state.combat.overheat = Math.max(0, state.combat.overheat - dt * 1.5);
    }
    state.combat.damageMult = 1 + Math.min(0.5, state.combat.overheat * 0.1);
  } else {
    state.combat.damageMult = 1;
    state.combat.overheat = 0;
  }
}

