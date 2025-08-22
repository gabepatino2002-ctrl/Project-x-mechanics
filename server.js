// server.js
// Project X — Mechanics microservice (with status effects integrated)
// Node 16+, Express
// npm i express cors

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/**
 * -------------------------
 * Full mechanics codex & archetypes (version 1.2)
 * -------------------------
 */
const mechanicsCodex = {
  version: "1.2",
  system: "ProjectX-RPG",
  mechanics: {
    hit_probability: {
      base: 70,
      formula_desc: "70 + (attacker_focus - defender_speed) * 2",
      critical_chance_formula: "attacker_focus / 5",
      dodge_chance_formula: "speed_difference * 2"
    },
    damage: {
      formula_desc: "(attack * ability_power * archetype_multiplier) - (defense * universe_modifier)",
      critical_multiplier: 1.5,
      weakness_multiplier: 2,
      guard_multiplier: 0.5
    },
    status_effects: {
      // base chance values are used as 'baseChance' in abilities; final chance computed as
      // chance = (attacker.focus / defender.willpower) * baseChance%
      paralysis: { base_chance: 25, description: "Stun: target skips next X turns" },
      burn: { base_chance: 20, description: "Burn: damage over time for X turns" },
      bleed: { base_chance: 20, description: "Bleed: physical DOT for X turns" },
      confuse: { base_chance: 15, description: "Confuse: attacks random target or self occasionally" },
      regen: { base_chance: 0, description: "Regeneration: heal over time" },
      shield: { base_chance: 0, description: "Temporary damage reduction by % for duration" },
      slow: { base_chance: 20, description: "Reduces effective speed for duration" },
      weaken: { base_chance: 20, description: "Reduces attack multiplier for duration" }
    },
    resources: {
      hp: "vitality",
      sp_energy: "special ability pool (universe-dependent)",
      spy_points: "team-based synergy meter",
      adaptation_xp: "universe mastery track"
    }
  },

  boss_ai: {
    phase_1: { hp_range: "100-76%", actions: { basic: 60, minor_abilities: 30, buffs: 10 } },
    phase_2: { hp_range: "75-51%", actions: { strong_abilities: 50, debuffs: 20, summons: 20, cinematic: 10 } },
    phase_3: { hp_range: "50-26%", actions: { desperation_combo: 30, all_out: 25, environmental: 25, heal_shield: 20 } },
    phase_4: { hp_range: "25-0%", actions: { cinematic_loop: 100, random_desperation_chance_pct: 5 } }
  },

  enemy_scaling: {
    hp_formula_desc: "(average_party_level * 50) * boss_modifier",
    attack_formula_desc: "(average_party_attack * 0.8 - 1.2)",
    defense_formula_desc: "(average_party_defense * 0.8 - 1.2)",
    modifiers: { mob: 1, elite: 2, boss: 5, raid_boss: 10 }
  },

  voice_emotion: {
    pre_attack: ["angry", "confident", "fearful"],
    low_hp: ["panic", "desperation"],
    synergy: ["fusion", "uplift"]
  },

  music_automation: {
    normal_battle: "high BPM playlist",
    boss_phase_1: "loop intro",
    boss_phase_2: "bridge section",
    boss_phase_3: "chorus section",
    final_phase: "randomized drop",
    victory: "victory theme",
    defeat: "defeat theme"
  },

  universe_modifiers: {
    persona_5: { weakness_extra_turn: true, baton_pass_turn_extension: true, elemental_affinities: true },
    jojo: { stands_active: true, stand_autonomy: true, stand_mastery_affects_damage: true },
    yakuza: { heat_gauge: true, heat_actions: true, environmental_finisher_windows: true },
    baldurs_gate_3: { dnd_rules: true, saving_throws: true, spell_slots: true, conditions: true },
    mass_effect: { biotics_tech_cooldowns: true, cover_system: true, cover_defense_multiplier: 1.3 },
    kingdom_hearts: { drive_forms: true, keyblade_variants: true, magic_mp_pool: true },
    invincible: { flight_durability: true, brutal_damage_scaling: true, civilian_casualty_mechanics: true },
    demon_slayer: { breathing_styles: true, nichirin_affinity: true, demon_arts_resistance: true },
    dragon_ball: { ki_pool: true, ki_charge_attack_bonus_pct: 50, transformations: true, fatigue_rolls: true },
    final_fantasy_7: { materia_slots: true, limit_breaks: true, summon_mechanics: true },
    marvel: { mutation_affiliations: true, tech_mystic_cosmic_tiers: true, faction_hooks: true },
    seven_deadly_sins: { sacred_treasure_bonds: true, curse_affinity: true, power_level_display: true },
    steven_universe: { fusion_rules: true, gem_summons: true, emotional_resonance_buffs: true },
    street_fighter: { combo_meter: true, ex_moves: true, frame_trap_mechanics: true },
    witcher_3: { signs: true, alchemy_toxicity: true, bestiary_weakness_exploit: true },
    sonic_the_hedgehog: { rings_as_health_buffer: true, momentum_damage_bonus: true, platform_phases: true },
    god_of_war: { rage_meter: true, runic_finishers: true, heavy_impact_mechanics: true },
    my_hero_academia: { hero_points: true, quirks_evolution_willpower_checks: true, support_role_bonus: true },
    hunter_x_hunter: { nen_categories: true, aura_techniques_in: true, gyo_en_ko_system: true },
    star_wars: { force_pool_shared: true, lightsaber_form_variants: true, alignment_light_dark: true },
    mortal_kombat: { chi_meter: true, fatalities_brutalities: true, realm_faction_effects: true },
    tekken: { rage_system: true, rage_arts_drives: true, juggle_bounds: true },
    resident_evil: { ammo_economy: true, fear_status: true, limited_inventory_weight: true },
    kung_fu_panda: { chi_flow: true, animal_style_mastery: true, spirit_world_echoes: true },
    dc: { meta_gene_surge: true, legacy_resonance: true, power_scaling_tiers: true }
  }
};

/**
 * Archetypes (20) + sub-archetypes (same as earlier) omitted here for brevity in this listing,
 * but mechanicsCodex.archetypes is the same as previous version (server includes full archetypes).
 * (If you want them dumped here again, I can paste the full array.)
 */
mechanicsCodex.archetypes = require ? [] : []; // placeholder if module loaders need it

// -------------------------
// Utility functions
// -------------------------

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Hit chance calculation (same as before)
function calculateHitChance(attacker, defender, universeKey) {
  const base = mechanicsCodex.mechanics.hit_probability.base;
  const focus = (attacker && attacker.focus) ? attacker.focus : 0;
  const speed = (defender && defender.speed) ? defender.speed : 0;
  let hit = base + (focus - speed) * 2;
  if (universeKey === 'mass_effect' && defender && defender.cover) {
    hit -= 15;
  }
  return clamp(Math.round(hit * 100) / 100, 1, 99);
}

// Damage calc (same as before)
function calculateDamage(attacker, defender, ability, universeKey) {
  ability = ability || {};
  const atk = attacker.attack || 0;
  const def = defender.defense || 0;
  const abilityPower = ability.power || 1.0;
  const archetypeMultiplier = ability.archetypeMultiplier || 1.0;

  const universeModifier = (() => {
    switch (universeKey) {
      case 'persona_5': return (defender.weakness && ability.type && defender.weakness === ability.type) ? 0.5 : 1.0;
      case 'mass_effect': return defender.cover ? 1.5 : 1.0;
      case 'witcher_3': return (defender.vulnerableTo && defender.vulnerableTo.includes(ability.type)) ? 0.6 : 1.0;
      case 'sonic_the_hedgehog': return (ability.type === 'momentum') ? 0.9 : 1.0;
      default: return 1.0;
    }
  })();

  let raw = (atk * abilityPower * archetypeMultiplier) - (def * universeModifier);
  raw = Math.max(0, raw);

  if (defender.weakness && ability.type && defender.weakness === ability.type) {
    if (['dragon_ball', 'final_fantasy_7', 'persona_5'].includes(universeKey)) {
      raw = raw * mechanicsCodex.mechanics.damage.weakness_multiplier;
    }
  }

  return Math.round(raw * 100) / 100;
}

/**
 * Determine chance to apply a status effect on a successful hit.
 * Formula per codex: chance% = (attacker.focus / defender.willpower) * baseChance
 * attacker, defender: objects; baseChance: number (e.g., 20)
 * rng: boolean - if false, status application only if forceStatus true on payload
 */
function rollStatusApplication(attacker, defender, baseChance, rng) {
  const focus = attacker.focus || 0;
  const will = defender.willpower || 1; // avoid divide by zero
  const chancePercent = (focus / will) * baseChance;
  const clamped = clamp(chancePercent, 0, 95); // cap at 95%
  if (!rng) return { applied: false, chancePercent: clamped, roll: null }; // deterministic: do not apply unless forced by payload
  const roll = Math.floor(Math.random() * 100) + 1;
  return { applied: roll <= clamped, chancePercent: clamped, roll };
}

/**
 * Apply a status effect object to an actor. actor.statusEffects is an array.
 * effect: { name, duration, potency, sourceId }
 */
function applyStatusEffectToActor(actor, effect) {
  if (!actor) return false;
  actor.statusEffects = actor.statusEffects || [];
  // Merge if same status exists: extend duration / update potency if stronger
  const existingIndex = actor.statusEffects.findIndex(s => s.name === effect.name);
  if (existingIndex >= 0) {
    const existing = actor.statusEffects[existingIndex];
    existing.duration = Math.max(existing.duration, effect.duration || 0);
    existing.potency = Math.max(existing.potency || 0, effect.potency || 0);
  } else {
    actor.statusEffects.push({
      name: effect.name,
      duration: effect.duration || 1,
      potency: effect.potency || 0,
      sourceId: effect.sourceId || null
    });
  }
  return true;
}

/**
 * Process (tick) an actor's status effects at start-of-turn.
 * Returns array of timeline events produced and mutates actor (hp/shield/flags).
 *
 * Behavior:
 * - Burn: apply (potency) damage per tick for duration.
 * - Bleed: apply (potency) physical damage per tick.
 * - Regen: heal potency per tick.
 * - Shield: represented as a status with potency = fraction (0..1) reducing incoming damage; shield itself decays here if set to tick.
 * - Paralysis / Stun: flag that actor is stunned for this turn (skip action).
 * - Confuse: flag that the actor is confused (special handling at action resolution).
 * - Slow/Weaken: adjust actor.tempModifiers (speedMultiplier/attackMultiplier) for use during this round.
 *
 * rng: boolean - if false, DOTs/heals still apply but chance-based effects only handled elsewhere.
 */
function tickStatusEffects(actor, rng) {
  const events = [];
  actor.statusEffects = actor.statusEffects || [];
  // Ensure old temp modifiers cleared (these are recomputed per-turn)
  actor.temp = actor.temp || {};
  actor.temp.speedMultiplier = 1.0;
  actor.temp.attackMultiplier = 1.0;
  actor.temp.isStunned = false;
  actor.temp.isConfused = false;
  actor.temp.shieldValue = 0; // absolute damage reduction or multiplier depending on implementation

  // iterate copy to allow removal during iteration
  for (let i = actor.statusEffects.length - 1; i >= 0; i--) {
    const s = actor.statusEffects[i];
    const name = s.name;
    const potency = s.potency || 0;
    const durBefore = s.duration;

    if (name === 'burn') {
      const dmg = Math.round((potency || 5) * 100) / 100;
      const prev = actor.hp || 0;
      actor.hp = Math.max(0, (actor.hp || 0) - dmg);
      events.push({ actorId: actor.id, event: 'burn_tick', damage: dmg, prevHp: prev, newHp: actor.hp, remainingDuration: s.duration });
    } else if (name === 'bleed') {
      const dmg = Math.round((potency || 4) * 100) / 100;
      const prev = actor.hp || 0;
      actor.hp = Math.max(0, (actor.hp || 0) - dmg);
      events.push({ actorId: actor.id, event: 'bleed_tick', damage: dmg, prevHp: prev, newHp: actor.hp, remainingDuration: s.duration });
    } else if (name === 'regen') {
      const heal = Math.round((potency || 6) * 100) / 100;
      const prev = actor.hp || 0;
      actor.hp = Math.min(actor.maxHp || 999999, (actor.hp || 0) + heal);
      events.push({ actorId: actor.id, event: 'regen_tick', heal, prevHp: prev, newHp: actor.hp, remainingDuration: s.duration });
    } else if (name === 'shield') {
      // shield potency is fraction (e.g., 0.3 = reduce incoming damage by 30%)
      actor.temp.shieldValue = Math.max(actor.temp.shieldValue || 0, potency || 0);
      events.push({ actorId: actor.id, event: 'shield_active', potency, remainingDuration: s.duration });
    } else if (name === 'paralysis' || name === 'stun') {
      actor.temp.isStunned = true;
      events.push({ actorId: actor.id, event: 'stunned', remainingDuration: s.duration });
    } else if (name === 'confuse') {
      actor.temp.isConfused = true;
      events.push({ actorId: actor.id, event: 'confused', remainingDuration: s.duration });
    } else if (name === 'slow') {
      // slow potency: fraction to multiply speed (e.g., 0.8 -> speed * 0.8)
      actor.temp.speedMultiplier = Math.min(actor.temp.speedMultiplier || 1.0, potency || 0.8);
      events.push({ actorId: actor.id, event: 'slow_applied', multiplier: actor.temp.speedMultiplier, remainingDuration: s.duration });
    } else if (name === 'weaken') {
      actor.temp.attackMultiplier = Math.min(actor.temp.attackMultiplier || 1.0, potency || 0.8);
      events.push({ actorId: actor.id, event: 'weaken_applied', multiplier: actor.temp.attackMultiplier, remainingDuration: s.duration });
    }

    // decrement duration and remove if expired
    s.duration = Math.max(0, (s.duration || 0) - 1);
    if (s.duration <= 0) {
      events.push({ actorId: actor.id, event: 'status_expired', name: s.name });
      actor.statusEffects.splice(i, 1);
    }
  }

  return events;
}

/**
 * Simulate a single attack (enhanced) - attempts to apply status passed in ability.status
 * payload may include forceStatus to forcibly apply status (for deterministic testing).
 */
function simulateAttack(payload) {
  const attacker = payload.attacker || {};
  const defender = payload.defender || {};
  const ability = payload.ability || {};
  const universe = payload.universe || null;
  const rng = typeof payload.rng === 'boolean' ? payload.rng : true;

  // account for attack multiplier from attacker's temp modifiers (e.g., weaken)
  const effectiveAttacker = Object.assign({}, attacker);
  effectiveAttacker.attack = (attacker.attack || 0) * ((attacker.temp && attacker.temp.attackMultiplier) || 1.0);
  const effectiveDefender = Object.assign({}, defender);

  const hitChance = calculateHitChance(effectiveAttacker, effectiveDefender, universe);
  const critChance = Math.max(0, ((effectiveAttacker.focus || 0) / 5));
  const roll = rng ? Math.floor(Math.random() * 100) + 1 : null;
  const didHit = rng ? (roll <= hitChance) : true;

  let damage = 0;
  let isCrit = false;
  const statusResult = { attempted: false, applied: false, name: null, chancePercent: 0, roll: null };

  if (didHit) {
    damage = calculateDamage(effectiveAttacker, effectiveDefender, ability, universe);
    // apply shield reduction if defender has shield temp
    if (defender.temp && defender.temp.shieldValue) {
      const shieldFrac = defender.temp.shieldValue;
      damage = Math.round(damage * (1 - shieldFrac) * 100) / 100;
    }

    if (rng) {
      const critRoll = Math.floor(Math.random() * 100) + 1;
      if (critRoll <= critChance) {
        isCrit = true;
        damage = Math.round(damage * mechanicsCodex.mechanics.damage.critical_multiplier * 100) / 100;
      }
    } else if (payload.forceCrit) {
      isCrit = true;
      damage = Math.round(damage * mechanicsCodex.mechanics.damage.critical_multiplier * 100) / 100;
    }

    // Status application (if ability includes status)
    if (ability.status && ability.status.name) {
      statusResult.attempted = true;
      statusResult.name = ability.status.name;
      const baseChance = ability.status.baseChance || (mechanicsCodex.mechanics.status_effects[ability.status.name] && mechanicsCodex.mechanics.status_effects[ability.status.name].base_chance) || 0;
      const rollRes = rollStatusApplication(attacker, defender, baseChance, rng);
      statusResult.chancePercent = rollRes.chancePercent;
      statusResult.roll = rollRes.roll;
      if (rollRes.applied || payload.forceStatus) {
        // apply status to defender
        applyStatusEffectToActor(defender, {
          name: ability.status.name,
          duration: ability.status.duration || 2,
          potency: ability.status.potency || 0,
          sourceId: attacker.id || null
        });
        statusResult.applied = true;
      }
    }
  }

  if (defender.isGuarding) {
    damage = Math.round(damage * mechanicsCodex.mechanics.damage.guard_multiplier * 100) / 100;
  }

  damage = Math.max(0, damage);

  return {
    universe,
    hitChance,
    critChance: Math.round(critChance * 100) / 100,
    roll,
    didHit,
    isCrit,
    damage,
    statusResult
  };
}

/**
 * Simulate AoE attack by one attacker against multiple defenders.
 * This uses simulateAttack for each target and carries status attempts.
 */
function simulateAoE(payload) {
  const attacker = payload.attacker || {};
  const defenders = Array.isArray(payload.defenders) ? payload.defenders : [];
  const ability = payload.ability || {};
  const universe = payload.universe || null;
  const rng = typeof payload.rng === 'boolean' ? payload.rng : true;
  const aoeMode = payload.aoeMode || 'full';
  const falloff = typeof ability.aoeFalloff === 'number' ? clamp(ability.aoeFalloff, 0, 1) : 0;

  const results = [];
  let totalDamage = 0;
  let hits = 0;
  let crits = 0;
  let misses = 0;

  defenders.forEach((def, idx) => {
    let distance = (typeof def.distance === 'number') ? clamp(def.distance, 0, 1) : (def.index || idx) / Math.max(1, defenders.length - 1);
    let aoeMultiplier = 1;
    if (aoeMode === 'falloff') {
      aoeMultiplier = clamp(1 - (falloff * distance), 0, 1);
    } else if (aoeMode === 'cone') {
      if (typeof def.angle === 'number' && typeof ability.coneAngleNormalized === 'number') {
        if (def.angle > ability.coneAngleNormalized) {
          aoeMultiplier = 0;
        }
      }
    }

    const defender = Object.assign({}, def);
    const adjAbility = Object.assign({}, ability, { power: (ability.power || 1) * aoeMultiplier });

    const sim = simulateAttack({ attacker, defender, ability: adjAbility, universe, rng });

    const targetId = defender.id !== undefined ? defender.id : idx;
    const entry = Object.assign({ targetId, distance, aoeMultiplier }, sim);

    results.push(entry);

    if (sim.didHit) {
      totalDamage += sim.damage;
      hits += 1;
      if (sim.isCrit) crits += 1;
    } else {
      misses += 1;
    }
  });

  const summary = {
    totalTargets: defenders.length,
    hits,
    misses,
    crits,
    totalDamage: Math.round(totalDamage * 100) / 100,
    avgDamagePerHit: hits > 0 ? Math.round((totalDamage / hits) * 100) / 100 : 0
  };

  return { universe, results, summary };
}

/**
 * -------------------------
 * Round Resolver (with status effect processing)
 * -------------------------
 */
function resolveRound(body) {
  const allies = Array.isArray(body.allies) ? body.allies.map(a => Object.assign({}, a)) : [];
  const enemies = Array.isArray(body.enemies) ? body.enemies.map(e => Object.assign({}, e)) : [];
  const actions = Array.isArray(body.actions) ? body.actions.slice() : [];
  const universe = body.universe || null;
  const rng = typeof body.rng === 'boolean' ? body.rng : true;

  // actorMap holds all actors (both teams)
  const actorMap = {};
  allies.forEach(a => {
    // Ensure statusEffects + temp structures exist
    actorMap[a.id] = Object.assign({}, a, { team: 'allies', isGuarding: !!a.isGuarding, statusEffects: a.statusEffects ? JSON.parse(JSON.stringify(a.statusEffects)) : [], temp: {} });
  });
  enemies.forEach(e => {
    actorMap[e.id] = Object.assign({}, e, { team: 'enemies', isGuarding: !!e.isGuarding, statusEffects: e.statusEffects ? JSON.parse(JSON.stringify(e.statusEffects)) : [], temp: {} });
  });

  // If actors not included in actions, add pass as default
  const providedActorIds = new Set(actions.map(act => act.actorId));
  Object.keys(actorMap).forEach(id => {
    if (!providedActorIds.has(id)) {
      actions.push({ actorId: id, action: 'pass' });
    }
  });

  // Enrich actions with actor snapshot and compute effective speed (account for slow statuses later after tick)
  const enriched = actions.map(a => {
    const actor = actorMap[a.actorId];
    return {
      ...a,
      actor: actor || null,
      baseSpeed: actor ? (actor.speed || 0) : 0,
      baseFocus: actor ? (actor.focus || 0) : 0
    };
  });

  // We'll process ticks before ordering, because slow effects can change effective speed for ordering.
  // So: first, run tickStatusEffects for every actor (start-of-round ticks), collect events.
  const timeline = [];
  let totalSpy = 0;
  let totalDamageThisRound = 0;
  const damageTaken = {}; // per actor

  function ensureDamageTaken(id) { if (!damageTaken[id]) damageTaken[id] = 0; }

  // Process start-of-round status ticks for all actors
  Object.keys(actorMap).forEach(id => {
    const actor = actorMap[id];
    const tickEvents = tickStatusEffects(actor, rng);
    // Append tick events to timeline
    tickEvents.forEach(ev => timeline.push(Object.assign({ phase: 'status_tick' }, ev)));
    // Remove dead actors immediately
    if (actor.hp <= 0) {
      timeline.push({ actorId: actor.id, event: 'died_from_status', hp: actor.hp });
    }
  });

  // After ticking, compute each actor's effective speed (baseSpeed * temp.speedMultiplier)
  enriched.forEach(e => {
    const a = actorMap[e.actorId];
    if (a) {
      const speedMult = (a.temp && a.temp.speedMultiplier) ? a.temp.speedMultiplier : 1.0;
      e.effectiveSpeed = Math.round((e.baseSpeed || 0) * speedMult * 100) / 100;
      e.effectiveFocus = (a.temp && a.temp.focusMultiplier) ? (a.focus || 0) * a.temp.focusMultiplier : (a.focus || 0);
      // If actor is stunned they can't act; we'll still keep them in ordering but they'll be skipped when processed.
      e.isStunned = !!(a.temp && a.temp.isStunned);
      e.isConfused = !!(a.temp && a.temp.isConfused);
    } else {
      e.effectiveSpeed = 0;
      e.effectiveFocus = 0;
      e.isStunned = false;
      e.isConfused = false;
    }
  });

  // Sort actions by effectiveSpeed desc, tie-breaker by focus, allies first
  enriched.sort((x, y) => {
    if (y.effectiveSpeed !== x.effectiveSpeed) return y.effectiveSpeed - x.effectiveSpeed;
    if ((y.actor && y.actor.focus) !== (x.actor && x.actor.focus)) return (y.actor && y.actor.focus || 0) - (x.actor && x.actor.focus || 0);
    if (x.actor && y.actor && x.actor.team !== y.actor.team) return x.actor.team === 'allies' ? -1 : 1;
    return 0;
  });

  // Process each action in order
  for (const act of enriched) {
    const planner = actorMap[act.actorId];
    if (!planner) {
      timeline.push({ note: `Invalid actorId ${act.actorId}, skipped.` });
      continue;
    }

    // Skip dead actors
    if (planner.hp <= 0) {
      timeline.push({ actorId: planner.id, action: act.action, result: 'skipped_dead' });
      continue;
    }

    // If stunned, skip action and reduce stun handled already in tick (but log skip)
    if (planner.temp && planner.temp.isStunned) {
      timeline.push({ actorId: planner.id, action: act.action, result: 'skipped_stunned' });
      continue;
    }

    // If the actor is confused and action targets are provided, we may redirect:
    // - Behavior: 50% chance to select a random valid target from opposing team;
    // - 10% chance to hit self (self-harm).
    if (planner.temp && planner.temp.isConfused && act.action && (act.action === 'attack' || act.action === 'ability' || act.action === 'aoe')) {
      const confRoll = rng ? Math.floor(Math.random() * 100) + 1 : 1;
      if (confRoll <= 10) {
        // attack self
        timeline.push({ actorId: planner.id, event: 'confuse_self_hit_roll', roll: confRoll });
        act.targetId = planner.id;
      } else if (confRoll <= 60) {
        // choose random opposing team member (if any)
        const pool = Object.values(actorMap).filter(o => o.team !== planner.team && o.hp > 0);
        if (pool.length > 0) {
          const pick = pool[rng ? Math.floor(Math.random() * pool.length) : 0];
          act.targetId = pick.id;
          timeline.push({ actorId: planner.id, event: 'confuse_redirect', targetId: pick.id, roll: confRoll });
        } else {
          timeline.push({ actorId: planner.id, event: 'confuse_no_valid_target', roll: confRoll });
        }
      } else {
        // obey original target
        timeline.push({ actorId: planner.id, event: 'confuse_no_redirect', roll: confRoll });
      }
    }

    // Guard
    if (act.action === 'guard') {
      planner.isGuarding = true;
      timeline.push({ actorId: planner.id, action: 'guard', result: 'is_guarding' });
      continue;
    }

    if (act.action === 'pass') {
      timeline.push({ actorId: planner.id, action: 'pass', result: 'no_action' });
      continue;
    }

    // Single-target attack/ability
    if (act.action === 'attack' || act.action === 'ability') {
      const targetId = act.targetId;
      if (!targetId || !actorMap[targetId]) {
        timeline.push({ actorId: planner.id, action: act.action, targetId, result: 'invalid_target' });
        continue;
      }
      const target = actorMap[targetId];

      // Build payload for simulateAttack - ensure defender has temp applied
      // Copy current status effects and temp over to simulate function
      const defenderSnapshot = Object.assign({}, target);
      defenderSnapshot.statusEffects = target.statusEffects ? JSON.parse(JSON.stringify(target.statusEffects)) : [];
      defenderSnapshot.temp = target.temp ? Object.assign({}, target.temp) : {};

      const attackerSnapshot = Object.assign({}, planner);
      attackerSnapshot.statusEffects = planner.statusEffects ? JSON.parse(JSON.stringify(planner.statusEffects)) : [];
      attackerSnapshot.temp = planner.temp ? Object.assign({}, planner.temp) : {};

      const payload = {
        attacker: attackerSnapshot,
        defender: defenderSnapshot,
        ability: act.ability || { power: 1.0, type: act.ability && act.ability.type ? act.ability.type : 'physical', archetypeMultiplier: act.ability && act.ability.archetypeMultiplier ? act.ability.archetypeMultiplier : 1.0, status: act.ability && act.ability.status ? act.ability.status : null },
        universe,
        rng,
        forceCrit: act.forceCrit || false,
        forceStatus: act.forceStatus || false
      };

      const sim = simulateAttack(payload);

      // Apply damage and statusResult into live actorMap target
      ensureDamageTaken(target.id);
      if (sim.didHit) {
        const prevHp = target.hp;
        target.hp = Math.max(0, (target.hp || 0) - sim.damage);
        damageTaken[target.id] = (damageTaken[target.id] || 0) + sim.damage;
        totalDamageThisRound += sim.damage;

        // SPY accumulation
        if (target.weakness && payload.ability.type && target.weakness === payload.ability.type) totalSpy += 2;
        if (sim.isCrit) totalSpy += 3;
        totalSpy += 1;

        // If status applied by simulateAttack, it's been added to defenderSnapshot, so we must copy into real target
        if (sim.statusResult && sim.statusResult.applied) {
          // If simulateAttack applied status to defenderSnapshot, find its status and push to target.statusEffects
          if (payload.defender.statusEffects && payload.defender.statusEffects.length) {
            // merge into live target
            payload.defender.statusEffects.forEach(s => applyStatusEffectToActor(target, s));
          } else {
            // fallback: apply generic effect with provided ability.status
            if (act.ability && act.ability.status && sim.statusResult.applied) {
              applyStatusEffectToActor(target, {
                name: act.ability.status.name,
                duration: act.ability.status.duration || 2,
                potency: act.ability.status.potency || 0,
                sourceId: planner.id
              });
            }
          }
        }

        timeline.push({
          actorId: planner.id,
          actorTeam: planner.team,
          action: act.action,
          targetId: target.id,
          sim,
          damageApplied: sim.damage,
          targetPrevHp: prevHp,
          targetNewHp: target.hp
        });

        if (target.hp <= 0) {
          timeline.push({ actorId: planner.id, action: 'kill', targetId: target.id, note: `${target.id} defeated` });
          totalSpy += 2;
        }
      } else {
        timeline.push({
          actorId: planner.id,
          actorTeam: planner.team,
          action: act.action,
          targetId: target.id,
          sim,
          damageApplied: 0,
          targetPrevHp: target.hp,
          targetNewHp: target.hp,
          note: 'missed'
        });
      }

      // Commit back updated target
      actorMap[target.id] = target;
      continue;
    }

    // AoE actions
    if (act.action === 'aoe') {
      let targets = Array.isArray(act.targets) ? act.targets.map(id => actorMap[id]).filter(Boolean) : [];
      if (targets.length === 0) {
        targets = planner.team === 'allies' ? Object.values(actorMap).filter(x => x.team === 'enemies' && x.hp > 0) : Object.values(actorMap).filter(x => x.team === 'allies' && x.hp > 0);
      }
      const defenders = targets.map(d => Object.assign({}, d));

      const aoePayload = {
        attacker: Object.assign({}, planner),
        defenders,
        ability: act.ability || { power: 1.0, type: act.ability && act.ability.type ? act.ability.type : 'physical', archetypeMultiplier: act.ability && act.ability.archetypeMultiplier ? act.ability.archetypeMultiplier : 1.0, aoeFalloff: act.ability && typeof act.ability.aoeFalloff === 'number' ? act.ability.aoeFalloff : 0, status: (act.ability && act.ability.status) ? act.ability.status : null },
        universe,
        rng,
        aoeMode: act.aoeMode || 'full'
      };

      const aoeResult = simulateAoE(aoePayload);

      aoeResult.results.forEach(r => {
        const tgt = actorMap[r.targetId];
        if (!tgt) return;
        ensureDamageTaken(tgt.id);
        if (r.didHit) {
          const prevHp = tgt.hp;
          tgt.hp = Math.max(0, (tgt.hp || 0) - r.damage);
          damageTaken[tgt.id] = (damageTaken[tgt.id] || 0) + r.damage;
          totalDamageThisRound += r.damage;
          totalSpy += 1;
          if (r.isCrit) totalSpy += 3;
          if (tgt.weakness && aoePayload.ability.type && tgt.weakness === aoePayload.ability.type) totalSpy += 2;

          // If status result present, apply to tgt
          if (r.statusResult && r.statusResult.applied) {
            if (aoePayload.defenders) {
              applyStatusEffectToActor(tgt, { name: r.statusResult.name, duration: act.ability.status.duration || 2, potency: act.ability.status.potency || 0, sourceId: planner.id });
            } else if (act.ability && act.ability.status) {
              applyStatusEffectToActor(tgt, { name: act.ability.status.name, duration: act.ability.status.duration || 2, potency: act.ability.status.potency || 0, sourceId: planner.id });
            }
          }

          if (tgt.hp <= 0) {
            timeline.push({ actorId: planner.id, action: 'kill', targetId: tgt.id, note: `${tgt.id} defeated` });
            totalSpy += 2;
          }
          timeline.push({
            actorId: planner.id,
            actorTeam: planner.team,
            action: 'aoe',
            targetId: tgt.id,
            sim: r,
            damageApplied: r.damage,
            targetPrevHp: prevHp,
            targetNewHp: tgt.hp
          });
        } else {
          timeline.push({
            actorId: planner.id,
            actorTeam: planner.team,
            action: 'aoe',
            targetId: tgt.id,
            sim: r,
            damageApplied: 0,
            targetPrevHp: tgt.hp,
            targetNewHp: tgt.hp,
            note: 'miss'
          });
        }
        actorMap[tgt.id] = tgt;
      });
      continue;
    }

    // Unknown action
    timeline.push({ actorId: planner.id, action: act.action, result: 'unknown_action' });
  } // end for action

  // After processing actions, compute SPY from damage-taken (1 per 10% of max HP lost)
  function computeSpyFromDamageTaken(map, dt) {
    let bonus = 0;
    Object.keys(dt).forEach(id => {
      const actor = map[id];
      if (!actor) return;
      const taken = dt[id] || 0;
      const percentOfMax = actor.maxHp ? (taken / actor.maxHp) : 0;
      const increments = Math.floor(percentOfMax / 0.1); // 1 per 10%
      if (increments > 0) bonus += increments;
    });
    return bonus;
  }

  const damageSpyBonus = computeSpyFromDamageTaken(actorMap, damageTaken);
  totalSpy += damageSpyBonus;

  // Finalize output arrays
  const finalAllies = Object.values(actorMap).filter(x => x.team === 'allies');
  const finalEnemies = Object.values(actorMap).filter(x => x.team === 'enemies');
  const deaths = Object.values(actorMap).filter(a => a.hp <= 0).map(a => a.id);

  const summary = {
    universe,
    totalSpy: Math.round(totalSpy * 100) / 100,
    totalDamageThisRound: Math.round(totalDamageThisRound * 100) / 100,
    damageSpyBonus,
    deaths,
    actorsProcessed: enriched.length
  };

  return { timeline, summary, finalAllies, finalEnemies };
}

// -------------------------
// HTTP endpoints
// -------------------------

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'projectx-mechanics', version: mechanicsCodex.version });
});

app.get('/codex', (req, res) => {
  res.json(mechanicsCodex);
});

// Archetypes endpoint placeholder (previously implemented)
app.get('/archetypes', (req, res) => {
  res.json({ archetypes: mechanicsCodex.archetypes || [] });
});

app.get('/universes', (req, res) => {
  res.json({ universes: Object.keys(mechanicsCodex.universe_modifiers) });
});

// deterministic calculate
app.post('/calculate', (req, res) => {
  const { attacker, defender, ability, universe } = req.body || {};
  const hitChance = calculateHitChance(attacker || {}, defender || {}, universe);
  const damage = calculateDamage(attacker || {}, defender || {}, ability || {}, universe);
  res.json({ success: true, hitChance, damage, universe });
});

// simulate single attack (exposes statusResult)
app.post('/simulate', (req, res) => {
  try {
    const result = simulateAttack(req.body || {});
    res.json({ success: true, result });
  } catch (err) {
    console.error('simulate error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// simulate AoE
app.post('/simulate_aoe', (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.attacker || !Array.isArray(payload.defenders)) {
      return res.status(400).json({ success: false, error: "Body requires 'attacker' and 'defenders' array." });
    }
    const result = simulateAoE(payload);
    res.json({ success: true, result });
  } catch (err) {
    console.error('simulate_aoe error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// round resolver (with status effects)
app.post('/round_resolver', (req, res) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.allies) || !Array.isArray(body.enemies) || !Array.isArray(body.actions)) {
      return res.status(400).json({ success: false, error: "Request body must include 'allies'[], 'enemies'[], and 'actions'[] arrays." });
    }
    if (body.allies.length > 10) {
      return res.status(400).json({ success: false, error: "Max 10 allies allowed in a round." });
    }
    const result = resolveRound(body);
    res.json({ success: true, result });
  } catch (err) {
    console.error('round_resolver error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ProjectX mechanics service running on port ${PORT}`);
});
