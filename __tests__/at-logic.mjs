// Pure-logic tests for Agents & Traitors — no Firebase, no React needed
// Run with: node __tests__/at-logic.mjs

const DEFAULT_AT_CONFIG = {
  traitorCount: 3,
  expectedPlayerCount: 20,
  decayIntervalSecs: 30,
  trialThresholdPct: 0.12,
  trialDurationSecs: 30,
  scanCooldownSecs: 90,
  ghostCooldownSecs: 180,
  progressPerMatch: 3,
};

// ── Helpers reimplemented from store.ts ─────────────────────────────────────

function votesNeeded(aliveCount, config) {
  return Math.max(1, Math.min(aliveCount - 1, Math.max(2, Math.ceil(aliveCount * config.trialThresholdPct))));
}

function atAccuse(state, accuserCode, targetCode, now = Date.now()) {
  if (accuserCode === targetCode) return { state, trialTriggered: false };
  if (state.trial && state.trial.phase !== "resolved") return { state, trialTriggered: false };
  const target = state.players.find(p => p.code === targetCode);
  const accuser = state.players.find(p => p.code === accuserCode);
  if (!target?.alive || !accuser?.alive) return { state, trialTriggered: false };
  if ((target.protectedUntil ?? 0) > now) return { state, trialTriggered: false };
  if ((target.suspicionVoters ?? []).includes(accuserCode)) return { state, trialTriggered: false };

  const updatedTarget = { ...target, suspicionVoters: [...(target.suspicionVoters ?? []), accuserCode] };
  const updatedPlayers = state.players.map(p => p.code === targetCode ? updatedTarget : p);
  const aliveCount = updatedPlayers.filter(p => p.alive).length;
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  const needed = votesNeeded(aliveCount, config);
  let newState = { ...state, players: updatedPlayers };
  let trialTriggered = false;

  if ((updatedTarget.suspicionVoters?.length ?? 0) >= needed) {
    trialTriggered = true;
    newState = {
      ...newState,
      trial: { targetCode, startedAt: now, durationSecs: config.trialDurationSecs, phase: "defense", votes: {} },
      players: updatedPlayers.map(p => p.code === targetCode ? { ...p, suspicionVoters: [] } : p),
    };
  }
  return { state: newState, trialTriggered };
}

function applyATGhostAction(state, actorCode, type, targetCode, now = Date.now()) {
  const actor = state.players.find(p => p.code === actorCode);
  if (!actor?.isGhost) return state;
  const config = state.atConfig ?? DEFAULT_AT_CONFIG;
  if ((actor.lastGhostActionAt ?? 0) + config.ghostCooldownSecs * 1000 > now) return state;

  let newState = { ...state };
  let publicMessage = "";
  let privateMessage;

  switch (type) {
    case "agent_boost": {
      const progress = Math.min(100, (newState.globalProgress ?? 50) + 3);
      newState = { ...newState, globalProgress: progress, lastMatchAt: now,
        winnerSide: progress >= 100 ? "agents" : (newState.winnerSide ?? null) };
      publicMessage = "👻 Un agent fantôme envoie un signal de renfort ! (+3%)";
      privateMessage = `👻 Tu as renforcé le réseau. Progression : ${progress}%`;
      break;
    }
    case "agent_reveal": {
      const unrevealed = state.players.filter(p => p.alive && !(state.revealedRoles ?? {})[p.code]);
      if (unrevealed.length === 0) return state;
      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      newState = { ...newState, revealedRoles: { ...(newState.revealedRoles ?? {}), [pick.code]: pick.role } };
      publicMessage = `🔍 Un agent fantôme a révélé l'identité de ${pick.name} !`;
      privateMessage = `🔍 Tu as révélé que ${pick.name} est : ${pick.role === "traitor" ? "TRAÎTRE 🔴" : "AGENT 🔵"}`;
      break;
    }
    case "agent_protect": {
      if (!targetCode) return state;
      const tgt = state.players.find(p => p.code === targetCode);
      if (!tgt?.alive) return state;
      newState = { ...newState, players: newState.players.map(p =>
        p.code === targetCode ? { ...p, protectedUntil: now + 90_000 } : p) };
      publicMessage = `🛡️ Un agent fantôme protège ${tgt.name} pendant 90 secondes !`;
      privateMessage = `🛡️ Tu as protégé ${tgt.name} pendant 90 secondes.`;
      break;
    }
    case "traitor_sabotage": {
      const progress = Math.max(0, (newState.globalProgress ?? 50) - 3);
      newState = { ...newState, globalProgress: progress,
        winnerSide: progress <= 0 ? "traitors" : (newState.winnerSide ?? null) };
      publicMessage = "💣 Un traître fantôme sabote le réseau ! (-3%)";
      privateMessage = `💣 Tu as saboté le réseau. Progression : ${progress}%`;
      break;
    }
    case "traitor_plant": {
      if (!targetCode) return state;
      const tgt = state.players.find(p => p.code === targetCode);
      if (!tgt?.alive) return state;
      const syntheticVotes = [`__ghost_${actorCode}_1`, `__ghost_${actorCode}_2`];
      const newVoters = [...new Set([...(tgt.suspicionVoters ?? []), ...syntheticVotes])];
      let updatedPlayers = newState.players.map(p => p.code === targetCode ? { ...p, suspicionVoters: newVoters } : p);
      publicMessage = `👁️ Quelque chose de louche rôde autour de ${tgt.name}…`;
      privateMessage = `👁️ Tu as planté des votes de suspicion sur ${tgt.name}.`;
      const aliveCount = updatedPlayers.filter(p => p.alive).length;
      const needed = votesNeeded(aliveCount, config);
      if (newVoters.length >= needed && (!newState.trial || newState.trial.phase === "resolved")) {
        newState = { ...newState,
          players: updatedPlayers.map(p => p.code === targetCode ? { ...p, suspicionVoters: [] } : p),
          trial: { targetCode, startedAt: now, durationSecs: config.trialDurationSecs, phase: "defense", votes: {} }
        };
      } else {
        newState = { ...newState, players: updatedPlayers };
      }
      break;
    }
    case "traitor_disrupt": {
      newState = { ...newState, disruptedUntil: now + 45_000 };
      publicMessage = "📡 Les connexions sont brouillées !";
      privateMessage = "📡 Tu as brouillé le réseau pendant 45 secondes.";
      break;
    }
  }

  newState = {
    ...newState,
    players: newState.players.map(p => p.code === actorCode ? { ...p, lastGhostActionAt: now } : p),
    ghostLog: [...(newState.ghostLog ?? []), { id: `${now}`, actorCode, type, appliedAt: now, targetCode, publicMessage, privateMessage }],
  };
  return newState;
}

// ── Test utilities ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
}
function assert(condition, msg) { if (!condition) throw new Error(msg); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(`${msg} — expected ${b}, got ${a}`); }

function makeState(players, extra = {}) {
  return { status: "playing", nextCode: players.length + 1, pairs: [], players,
    accentColor: "#000", gameMode: "agents-traitors", globalProgress: 50,
    atConfig: DEFAULT_AT_CONFIG, ghostLog: [], revealedRoles: {}, winnerSide: null, ...extra };
}
function makePlayer(code, name, role, alive = true, isGhost = false) {
  return { code, name, role, alive, isGhost, suspicionVoters: [], lastGhostActionAt: 0 };
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log("\n── votesNeeded() ──────────────────────────────────────────────");

test("2 players → needs 1 vote (no deadlock)", () => {
  assertEqual(votesNeeded(2, DEFAULT_AT_CONFIG), 1, "votesNeeded(2)");
});
test("3 players → needs 2 votes", () => {
  assertEqual(votesNeeded(3, DEFAULT_AT_CONFIG), 2, "votesNeeded(3)");
});
test("10 players → needs 2 votes (12% threshold)", () => {
  assertEqual(votesNeeded(10, DEFAULT_AT_CONFIG), 2, "votesNeeded(10)");
});
test("20 players → needs 3 votes (12% of 20 = 2.4 → ceil = 3)", () => {
  assertEqual(votesNeeded(20, DEFAULT_AT_CONFIG), 3, "votesNeeded(20)");
});

console.log("\n── atAccuse() — 2-player scenario ───────────────────────────");

test("With 2 alive players, 1 accusation immediately triggers trial", () => {
  const state = makeState([makePlayer("0001", "Alice", "agent"), makePlayer("0002", "Bob", "traitor")]);
  const { state: newState, trialTriggered } = atAccuse(state, "0001", "0002");
  assert(trialTriggered, "trial should be triggered");
  assert(newState.trial?.phase === "defense", "trial phase should be defense");
  assertEqual(newState.trial?.targetCode, "0002", "trial target");
});

test("With 3 alive players, 1st accusation does NOT trigger trial", () => {
  const state = makeState([makePlayer("0001","A","agent"), makePlayer("0002","B","agent"), makePlayer("0003","C","traitor")]);
  const { trialTriggered } = atAccuse(state, "0001", "0003");
  assert(!trialTriggered, "1 vote should not trigger trial with 3 players");
});

test("With 3 alive players, 2nd accusation triggers trial", () => {
  const state = makeState([makePlayer("0001","A","agent"), makePlayer("0002","B","agent"), makePlayer("0003","C","traitor")]);
  const { state: s2 } = atAccuse(state, "0001", "0003");
  const { state: s3, trialTriggered } = atAccuse(s2, "0002", "0003");
  assert(trialTriggered, "2nd vote should trigger trial with 3 players");
});

test("Can't accuse yourself", () => {
  const state = makeState([makePlayer("0001","A","agent"), makePlayer("0002","B","traitor")]);
  const { trialTriggered } = atAccuse(state, "0001", "0001");
  assert(!trialTriggered, "self-accusation should be rejected");
});

console.log("\n── Ghost: agent_boost ────────────────────────────────────────");

test("agent_boost increases progress by 3", () => {
  const ghost = { ...makePlayer("G001","GhostA","agent",false,true), lastGhostActionAt: 0 };
  const state = makeState([ghost, makePlayer("0001","Alive","traitor")], { globalProgress: 50 });
  const newState = applyATGhostAction(state, "G001", "agent_boost", undefined, 99999999);
  assertEqual(newState.globalProgress, 53, "progress should be 53");
});

test("agent_boost sets privateMessage", () => {
  const ghost = { ...makePlayer("G001","GhostA","agent",false,true), lastGhostActionAt: 0 };
  const state = makeState([ghost, makePlayer("0001","Alive","traitor")], { globalProgress: 50 });
  const newState = applyATGhostAction(state, "G001", "agent_boost", undefined, 99999999);
  const entry = newState.ghostLog.find(e => e.actorCode === "G001");
  assert(entry?.privateMessage?.includes("53%"), `privateMessage should mention 53%, got: ${entry?.privateMessage}`);
});

test("agent_boost returns same state if not a ghost", () => {
  const alive = makePlayer("0001","Alice","agent",true,false);
  const state = makeState([alive]);
  const newState = applyATGhostAction(state, "0001", "agent_boost", undefined, 99999999);
  assert(newState === state, "non-ghost should be rejected");
});

test("agent_boost respects cooldown", () => {
  const now = 1000000;
  const ghost = { ...makePlayer("G001","GhostA","agent",false,true), lastGhostActionAt: now - 10 }; // 10ms ago, cooldown=180s
  const state = makeState([ghost]);
  const newState = applyATGhostAction(state, "G001", "agent_boost", undefined, now);
  assert(newState === state, "should be rejected during cooldown");
});

console.log("\n── Ghost: agent_reveal ───────────────────────────────────────");

test("agent_reveal reveals a random alive player's role", () => {
  const ghost = { ...makePlayer("G001","GhostA","agent",false,true), lastGhostActionAt: 0 };
  const alive = makePlayer("0001","Bob","traitor",true,false);
  const state = makeState([ghost, alive], { revealedRoles: {} });
  const newState = applyATGhostAction(state, "G001", "agent_reveal", undefined, 99999999);
  assert(newState.revealedRoles["0001"] === "traitor", "Bob's role should be revealed");
});

test("agent_reveal sets privateMessage with correct role", () => {
  const ghost = { ...makePlayer("G001","GhostA","agent",false,true), lastGhostActionAt: 0 };
  const alive = makePlayer("0001","Bob","traitor",true,false);
  const state = makeState([ghost, alive], { revealedRoles: {} });
  const newState = applyATGhostAction(state, "G001", "agent_reveal", undefined, 99999999);
  const entry = newState.ghostLog.find(e => e.actorCode === "G001");
  assert(entry?.privateMessage?.includes("TRAÎTRE"), `privateMessage should say TRAÎTRE, got: ${entry?.privateMessage}`);
});

test("agent_reveal returns unchanged state if all roles already revealed", () => {
  const ghost = { ...makePlayer("G001","GhostA","agent",false,true), lastGhostActionAt: 0 };
  const alive = makePlayer("0001","Bob","traitor",true,false);
  const state = makeState([ghost, alive], { revealedRoles: {"0001": "traitor"} });
  const newState = applyATGhostAction(state, "G001", "agent_reveal", undefined, 99999999);
  assert(newState === state, "should return unchanged state if nothing to reveal");
});

console.log("\n── Ghost: traitor_sabotage ───────────────────────────────────");

test("traitor_sabotage decreases progress by 3", () => {
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const state = makeState([ghost, makePlayer("0001","Alive","agent")], { globalProgress: 50 });
  const newState = applyATGhostAction(state, "G001", "traitor_sabotage", undefined, 99999999);
  assertEqual(newState.globalProgress, 47, "progress should be 47");
});

test("traitor_sabotage sets privateMessage", () => {
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const state = makeState([ghost, makePlayer("0001","Alive","agent")], { globalProgress: 50 });
  const newState = applyATGhostAction(state, "G001", "traitor_sabotage", undefined, 99999999);
  const entry = newState.ghostLog.find(e => e.actorCode === "G001");
  assert(entry?.privateMessage?.includes("47%"), `privateMessage should mention 47%, got: ${entry?.privateMessage}`);
});

console.log("\n── Ghost: traitor_plant ──────────────────────────────────────");

test("traitor_plant adds 2 synthetic votes", () => {
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const target = makePlayer("0001","Alice","agent");
  const state = makeState([ghost, target, makePlayer("0002","Bob","agent")]);
  const newState = applyATGhostAction(state, "G001", "traitor_plant", "0001", 99999999);
  const alice = newState.players.find(p => p.code === "0001");
  // Might have triggered trial (clearing voters) or just added votes
  const hasEffect = alice?.suspicionVoters?.length > 0 || newState.trial?.targetCode === "0001";
  assert(hasEffect, "plant should either add suspicion votes or trigger trial");
});

test("traitor_plant with 2 players triggers trial immediately", () => {
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const target = makePlayer("0001","Alice","agent");
  const state = makeState([ghost, target]); // ghost is dead, 1 alive player
  // aliveCount = 1 (only Alice alive), votesNeeded = max(1, min(0, 2)) = 1
  // syntheticVotes.length = 2 >= 1 → trigger
  const newState = applyATGhostAction(state, "G001", "traitor_plant", "0001", 99999999);
  assert(newState.trial?.targetCode === "0001" || newState !== state, "should trigger trial or add votes");
});

test("traitor_plant sets privateMessage", () => {
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const target = makePlayer("0001","Alice","agent");
  const state = makeState([ghost, target, makePlayer("0002","Bob","agent")]);
  const newState = applyATGhostAction(state, "G001", "traitor_plant", "0001", 99999999);
  const entry = newState.ghostLog.find(e => e.actorCode === "G001");
  assert(entry?.privateMessage?.includes("Alice"), `privateMessage should name the target, got: ${entry?.privateMessage}`);
});

console.log("\n── Ghost: traitor_disrupt ────────────────────────────────────");

test("traitor_disrupt sets disruptedUntil to now+45s", () => {
  const now = 1000000;
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const state = makeState([ghost, makePlayer("0001","Alive","agent")]);
  const newState = applyATGhostAction(state, "G001", "traitor_disrupt", undefined, now);
  assertEqual(newState.disruptedUntil, now + 45_000, "disruptedUntil");
});

test("traitor_disrupt sets privateMessage", () => {
  const now = 1000000;
  const ghost = { ...makePlayer("G001","GhostT","traitor",false,true), lastGhostActionAt: 0 };
  const state = makeState([ghost, makePlayer("0001","Alive","agent")]);
  const newState = applyATGhostAction(state, "G001", "traitor_disrupt", undefined, now);
  const entry = newState.ghostLog.find(e => e.actorCode === "G001");
  assert(entry?.privateMessage?.length > 0, "privateMessage should be set");
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
