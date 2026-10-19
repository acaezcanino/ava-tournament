// test.js — Simulates a small tournament to check swiss.js works.
// Run with:  npm test
import { pairNextRound, standings, eloAfterTournament } from "./swiss.js";

// Fake players (replace with real ones later)
const players = [
  { id: "p1", nickname: "Alo",    elo: 700 },
  { id: "p2", nickname: "Rook",   elo: 820 },
  { id: "p3", nickname: "Knight", elo: 680 },
  { id: "p4", nickname: "Bishop", elo: 910 },
  { id: "p5", nickname: "Pawn",   elo: 655 },
  { id: "p6", nickname: "Queen",  elo: 1000 },
  { id: "p7", nickname: "King",   elo: 760 },
];

const ROUNDS = 3;
const name = (id) => players.find((p) => p.id === id).nickname;
const rounds = [];

for (let r = 1; r <= ROUNDS; r++) {
  const round = pairNextRound(players, rounds);
  console.log(`\n--- Round ${r} ---`);
  for (const g of round.pairings) {
    // Fake result: higher ELO wins (just for testing)
    const w = players.find((p) => p.id === g.white);
    const b = players.find((p) => p.id === g.black);
    g.result = w.elo >= b.elo ? "1-0" : "0-1";
    console.log(`${name(g.white)} (W) vs ${name(g.black)} (B)  →  ${g.result}`);
  }
  if (round.bye) console.log(`Bye: ${name(round.bye)}`);
  rounds.push(round);
}

console.log("\n=== Final standings ===");
console.table(
  standings(players, rounds).map((s) => ({
    Player: s.nickname, Points: s.points, Buchholz: s.buchholz, ELO: s.elo,
  }))
);

console.log("=== New ELO ===");
console.table(
  eloAfterTournament(players, rounds).map((p) => ({
    Player: p.nickname, Before: p.oldElo, After: p.elo, Change: p.change,
  }))
);
