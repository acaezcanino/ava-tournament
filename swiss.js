// swiss.js — Core logic for the AVA chess tournament app
// Pure JavaScript, no database yet. Works in the browser or Node.
//
// DATA SHAPES
// player:  { id: "p1", nickname: "Alo", elo: 1450 }
// round:   { pairings: [ { white: "p1", black: "p2", result: "1-0" } ], bye: "p5" | null }
// result:  "1-0" (white wins), "0-1" (black wins), "1/2" (draw), or null (not played yet)

const POINTS = {
  "1-0": [1, 0],
  "0-1": [0, 1],
  "1/2": [0.5, 0.5],
};

// ---------- 1. STANDINGS ----------
// Goes through every round and calculates each player's stats.
export function computeStats(players, rounds) {
  const stats = {};
  for (const p of players) {
    stats[p.id] = { ...p, points: 0, opponents: [], whites: 0, blacks: 0, hadBye: false };
  }

  for (const round of rounds) {
    if (round.bye) {
      stats[round.bye].points += 1; // a bye counts as a win
      stats[round.bye].hadBye = true;
    }
    for (const g of round.pairings) {
      const w = stats[g.white];
      const b = stats[g.black];
      w.opponents.push(g.black);
      b.opponents.push(g.white);
      w.whites++;
      b.blacks++;
      if (g.result) {
        const [wp, bp] = POINTS[g.result];
        w.points += wp;
        b.points += bp;
      }
    }
  }

  // Buchholz tiebreak = sum of your opponents' points (harder opponents = higher)
  for (const s of Object.values(stats)) {
    s.buchholz = s.opponents.reduce((sum, id) => sum + stats[id].points, 0);
  }
  return stats;
}

// Sorted standings table: points, then Buchholz, then ELO
export function standings(players, rounds) {
  const stats = computeStats(players, rounds);
  return Object.values(stats).sort(
    (a, b) => b.points - a.points || b.buchholz - a.buchholz || b.elo - a.elo
  );
}

// ---------- 2. SWISS PAIRING ----------
// Rules: pair players with similar points, never repeat an opponent,
// balance colors, and give the bye to the lowest player who hasn't had one.
export function pairNextRound(players, rounds) {
  const stats = computeStats(players, rounds);

  // Rank: most points first; ties broken by higher ELO
  const ranked = Object.values(stats).sort(
    (a, b) => b.points - a.points || b.elo - a.elo
  );

  // Odd number of players -> try bye candidates from the bottom up
  const byeCandidates =
    ranked.length % 2 === 0 ? [null] : [...ranked].reverse().filter((p) => !p.hadBye);

  for (const byePlayer of byeCandidates) {
    const pool = ranked.filter((p) => p !== byePlayer);
    const pairs = backtrackPair(pool);
    if (pairs) {
      return {
        pairings: pairs.map(([a, b]) => assignColors(a, b)),
        bye: byePlayer ? byePlayer.id : null,
      };
    }
  }
  throw new Error("No valid pairing (too many rounds for this many players?)");
}

// Take the top player, try partners in order, recurse on the rest.
// If we get stuck, undo and try the next partner (backtracking).
function backtrackPair(pool) {
  if (pool.length === 0) return [];
  const [first, ...rest] = pool;
  for (const partner of partnerOrder(first, rest)) {
    if (first.opponents.includes(partner.id)) continue; // no rematches
    const remaining = rest.filter((p) => p !== partner);
    const result = backtrackPair(remaining);
    if (result) return [[first, partner], ...result];
  }
  return null;
}

// Dutch system: inside a score group, the top half plays the bottom half.
// Group of 8 -> 1v5, 2v6, 3v7, 4v8.
// Preferred partner = the player halfway down the group; if that one is
// impossible (rematch), try the next ones down, then up, then lower groups.
function partnerOrder(first, rest) {
  const same = rest.filter((p) => p.points === first.points);
  const lower = rest.filter((p) => p.points !== first.points);
  const ideal = Math.floor((same.length + 1) / 2) - 1;
  const order = [
    ...same.slice(Math.max(ideal, 0)),
    ...same.slice(0, Math.max(ideal, 0)).reverse(),
  ];
  return [...order, ...lower];
}

// Whoever has played white less often gets white
function assignColors(a, b) {
  const aBalance = a.whites - a.blacks;
  const bBalance = b.whites - b.blacks;
  const aWhite = aBalance < bBalance || (aBalance === bBalance && a.elo >= b.elo);
  return aWhite
    ? { white: a.id, black: b.id, result: null }
    : { white: b.id, black: a.id, result: null };
}

// ---------- 3. ELO UPDATE ----------
// Run once the tournament ends. Uses everyone's rating from BEFORE the event.
// Expected score: E = 1 / (1 + 10^((opponentElo - myElo) / 400))
// New rating:     R' = R + K * (actual - expected)
export function eloAfterTournament(players, rounds, K = 32) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const change = Object.fromEntries(players.map((p) => [p.id, 0]));

  for (const round of rounds) {
    for (const g of round.pairings) {
      if (!g.result) continue;
      const w = byId[g.white];
      const b = byId[g.black];
      const expectedW = 1 / (1 + 10 ** ((b.elo - w.elo) / 400));
      const [actualW, actualB] = POINTS[g.result];
      change[w.id] += K * (actualW - expectedW);
      change[b.id] += K * (actualB - (1 - expectedW));
    }
  }
  // Byes don't change ELO (no real opponent)

  return players.map((p) => ({
    ...p,
    oldElo: p.elo,
    elo: Math.round(p.elo + change[p.id]),
    change: Math.round(change[p.id]),
  }));
}
