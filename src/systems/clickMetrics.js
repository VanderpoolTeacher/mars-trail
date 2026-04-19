// Mars Trail — click-through / mash-detection heuristic.
// Pure functions. The game uses these to decide when a player is smashing
// through event modals without reading and should face an "emergency" event
// they can only survive by actually reading the text (issue #63).

export const CLICK_METRICS_CONFIG = {
  minReadMs: 1200,              // floor below which any decision is "too fast to read"
  readMsPerChar: 35,            // ~28 wpm slow-reader rate; scales expected time with body length
  mashScoreThreshold: 6,        // at or above this score, an emergency fires on the next event
  maxEmergenciesPerRun: 2,      // cap so a single run can't chain-die from this alone
  emergencyCooldownDelta: -4,   // mashScore reduction applied when an emergency fires
  scoreDelta: {
    didNotRead: 3,   // elapsed < 0.2 * expected
    skim:       2,   // elapsed < 0.5 * expected
    hurried:    1,   // elapsed < 0.75 * expected
    normal:     0,   // elapsed < expected
    thoughtful: -1   // elapsed >= expected
  }
};

export function initialClickMetrics() {
  return {
    mashScore: 0,
    emergenciesFired: 0,
    lastBucket: null,
    lastElapsedMs: null,
    lastExpectedMs: null
  };
}

export function expectedReadMs(text, cfg = CLICK_METRICS_CONFIG) {
  const len = (text || '').length;
  return Math.max(cfg.minReadMs, len * cfg.readMsPerChar);
}

export function classifyDecision(elapsedMs, expectedMs) {
  if (elapsedMs < expectedMs * 0.2)  return 'didNotRead';
  if (elapsedMs < expectedMs * 0.5)  return 'skim';
  if (elapsedMs < expectedMs * 0.75) return 'hurried';
  if (elapsedMs < expectedMs)        return 'normal';
  return 'thoughtful';
}

export function recordDecision(metrics, elapsedMs, descText, cfg = CLICK_METRICS_CONFIG) {
  const base = metrics || initialClickMetrics();
  const expected = expectedReadMs(descText, cfg);
  const bucket = classifyDecision(elapsedMs, expected);
  const delta = cfg.scoreDelta[bucket] ?? 0;
  const mashScore = Math.max(0, (base.mashScore || 0) + delta);
  return {
    ...base,
    mashScore,
    lastBucket: bucket,
    lastElapsedMs: elapsedMs,
    lastExpectedMs: expected
  };
}

export function shouldFireEmergency(metrics, cfg = CLICK_METRICS_CONFIG) {
  if (!metrics) return false;
  return (metrics.mashScore || 0) >= cfg.mashScoreThreshold &&
         (metrics.emergenciesFired || 0) < cfg.maxEmergenciesPerRun;
}

// Apply the "an emergency just fired" bookkeeping: bump the counter and
// pull mashScore down so the player gets a cooldown before the next fire.
export function afterEmergencyFired(metrics, cfg = CLICK_METRICS_CONFIG) {
  const base = metrics || initialClickMetrics();
  return {
    ...base,
    emergenciesFired: (base.emergenciesFired || 0) + 1,
    mashScore: Math.max(0, (base.mashScore || 0) + cfg.emergencyCooldownDelta)
  };
}
