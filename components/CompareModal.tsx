"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Swords,
  Trophy,
  Flame,
  ArrowRightLeft,
  Percent,
  Calendar,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Target,
  Zap,
} from "lucide-react";

interface CompareModalProps {
  players: Array<{
    id: string;
    displayName: string;
    roomNumber: string | null;
    rating?: { currentElo: number } | null;
  }>;
  initialPlayer1Id?: string;
  initialPlayer2Id?: string;
  onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  players,
  initialPlayer1Id,
  initialPlayer2Id,
  onClose,
}) => {
  const [p1Id, setP1Id] = useState(
    initialPlayer1Id || (players.length > 0 ? players[0].id : "")
  );
  const [p2Id, setP2Id] = useState(
    initialPlayer2Id || (players.length > 1 ? players[1].id : "")
  );

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchComparison = async (id1: string, id2: string) => {
    if (!id1 || !id2 || id1 === id2) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/compare?p1=${id1}&p2=${id2}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to compare players.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load comparison data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (p1Id && p2Id && p1Id !== p2Id) {
      fetchComparison(p1Id, p2Id);
    }
  }, [p1Id, p2Id]);

  const handleSwap = () => {
    const temp = p1Id;
    setP1Id(p2Id);
    setP2Id(temp);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5 border-b border-slate-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Head-to-Head Comparison
            </h2>
            <p className="text-xs text-slate-400">
              Side-by-side stats & match-up win probability prediction
            </p>
          </div>
        </div>

        {/* Player Selector Bar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-3">
            {/* Player 1 Dropdown */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                Player 1
              </label>
              <select
                value={p1Id}
                onChange={(e) => setP1Id(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select Player 1</option>
                {players.map((p) => (
                  <option key={`p1-${p.id}`} value={p.id}>
                    {p.displayName} {p.roomNumber ? `(Rm ${p.roomNumber})` : ""}{" "}
                    {p.rating ? `[${p.rating.currentElo.toFixed(0)}]` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              title="Swap Players"
              className="mt-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 flex-shrink-0"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            {/* Player 2 Dropdown */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-1">
                Player 2
              </label>
              <select
                value={p2Id}
                onChange={(e) => setP2Id(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select Player 2</option>
                {players.map((p) => (
                  <option key={`p2-${p.id}`} value={p.id}>
                    {p.displayName} {p.roomNumber ? `(Rm ${p.roomNumber})` : ""}{" "}
                    {p.rating ? `[${p.rating.currentElo.toFixed(0)}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {p1Id === p2Id && p1Id !== "" && (
            <p className="text-xs text-amber-400 mt-2.5 text-center">
              Please choose two different players to see their comparison.
            </p>
          )}
        </div>

        {/* Comparison Content Body */}
        <div className="overflow-y-auto pr-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Calculating Head-to-Head metrics & win probability...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400 text-sm">
              {error}
            </div>
          ) : !data ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Select two players above to view their head-to-head comparison.
            </div>
          ) : (
            <>
              {/* Prediction Centerpiece Banner */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-950/90 to-purple-950/20 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Predicted Win Probability
                  </div>
                  <span className="text-[11px] text-slate-300 font-mono bg-slate-900/90 border border-slate-800 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="text-slate-400">H2H:</span>
                    <span className="text-emerald-400 font-bold">{data.headToHead?.p1Wins ?? 0}</span>
                    <span className="text-slate-500">–</span>
                    <span className="text-purple-400 font-bold">{data.headToHead?.p2Wins ?? 0}</span>
                    <span className="text-slate-500 text-[10px]">({data.prediction.h2hMatchesCount} mtg{data.prediction.h2hMatchesCount === 1 ? "" : "s"})</span>
                  </span>
                </div>

                {/* Big Probabilities Display */}
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 truncate max-w-[150px] sm:max-w-none">
                      {data.player1.displayName}
                    </div>
                    <div className="text-3xl font-black font-mono text-white">
                      {data.prediction.winChanceP1}%
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
                    VS
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-semibold text-purple-400 truncate max-w-[150px] sm:max-w-none">
                      {data.player2.displayName}
                    </div>
                    <div className="text-3xl font-black font-mono text-white">
                      {data.prediction.winChanceP2}%
                    </div>
                  </div>
                </div>

                {/* Visual Ratio Progress Bar */}
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex mb-3 shadow-inner">
                  <div
                    style={{ width: `${data.prediction.winChanceP1}%` }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                    title={`${data.player1.displayName}: ${data.prediction.winChanceP1}%`}
                  />
                  <div
                    style={{ width: `${data.prediction.winChanceP2}%` }}
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
                    title={`${data.player2.displayName}: ${data.prediction.winChanceP2}%`}
                  />
                </div>

                {/* Predicted Points Scored / Match Simulation */}
                {data.prediction.projectedMatch && (
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 my-3.5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                        <Target className="w-3.5 h-3.5 text-emerald-400" /> Projected Match Score
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Score Distribution Model
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Game to 21 */}
                      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-semibold text-purple-400 flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5" /> Game to 21
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Exp: {data.prediction.projectedMatch.game21.projectedPointsP1} – {data.prediction.projectedMatch.game21.projectedPointsP2} pts
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-xl font-black text-white">
                            {data.prediction.projectedMatch.game21.predictedScoreP1} – {data.prediction.projectedMatch.game21.predictedScoreP2}
                          </div>
                          <div className="text-[10px] text-amber-400 font-semibold">
                            {data.prediction.projectedMatch.game21.likelihood}% probability
                          </div>
                        </div>
                      </div>

                      {/* Game to 11 */}
                      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-semibold text-sky-400 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> Game to 11
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Exp: {data.prediction.projectedMatch.game11.projectedPointsP1} – {data.prediction.projectedMatch.game11.projectedPointsP2} pts
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-xl font-black text-white">
                            {data.prediction.projectedMatch.game11.predictedScoreP1} – {data.prediction.projectedMatch.game11.predictedScoreP2}
                          </div>
                          <div className="text-[10px] text-amber-400 font-semibold">
                            {data.prediction.projectedMatch.game11.likelihood}% probability
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-500 italic mt-1 border-t border-slate-800/80 pt-2">
                  *{data.prediction.methodology}
                </p>
              </div>

              {/* Side-by-Side Stat Comparison Table */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="py-2.5 px-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="text-emerald-400 truncate max-w-[120px]">{data.player1.displayName}</span>
                  <span className="text-slate-500">Metric</span>
                  <span className="text-purple-400 truncate max-w-[120px] text-right">{data.player2.displayName}</span>
                </div>

                <div className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                  {/* Current ELO */}
                  <div className="py-3 px-4 flex items-center justify-between">
                    <span
                      className={`font-mono font-bold text-base ${
                        data.player1.currentElo >= data.player2.currentElo
                          ? "text-emerald-400 font-black"
                          : "text-slate-300"
                      }`}
                    >
                      {data.player1.currentElo.toFixed(1)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">Current ELO</span>
                    <span
                      className={`font-mono font-bold text-base text-right ${
                        data.player2.currentElo >= data.player1.currentElo
                          ? "text-purple-400 font-black"
                          : "text-slate-300"
                      }`}
                    >
                      {data.player2.currentElo.toFixed(1)}
                    </span>
                  </div>

                  {/* Peak ELO */}
                  <div className="py-2.5 px-4 flex items-center justify-between">
                    <span className="font-mono text-slate-300">
                      {data.player1.peakElo.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400">Peak ELO</span>
                    <span className="font-mono text-slate-300 text-right">
                      {data.player2.peakElo.toFixed(1)}
                    </span>
                  </div>

                  {/* Dorm Rank */}
                  <div className="py-2.5 px-4 flex items-center justify-between">
                    <span
                      className={`font-bold ${
                        data.player1.rank <= data.player2.rank
                          ? "text-amber-400 font-black"
                          : "text-slate-300"
                      }`}
                    >
                      #{data.player1.rank}
                    </span>
                    <span className="text-xs text-slate-400">Dorm Rank</span>
                    <span
                      className={`font-bold text-right ${
                        data.player2.rank <= data.player1.rank
                          ? "text-amber-400 font-black"
                          : "text-slate-300"
                      }`}
                    >
                      #{data.player2.rank}
                    </span>
                  </div>

                  {/* Overall Record */}
                  <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                    <span className="text-slate-300">
                      {data.player1.wins}W – {data.player1.losses}L
                    </span>
                    <span className="text-xs font-sans text-slate-400">Career Record</span>
                    <span className="text-slate-300 text-right">
                      {data.player2.wins}W – {data.player2.losses}L
                    </span>
                  </div>

                  {/* Head-to-Head Match Record */}
                  <div className="py-2.5 px-4 flex items-center justify-between font-mono bg-purple-950/15 border-y border-purple-500/20">
                    <span
                      className={`font-bold ${
                        (data.headToHead?.p1Wins ?? 0) > (data.headToHead?.p2Wins ?? 0)
                          ? "text-emerald-400 font-black"
                          : (data.headToHead?.p1Wins ?? 0) < (data.headToHead?.p2Wins ?? 0)
                          ? "text-slate-400"
                          : "text-slate-300"
                      }`}
                    >
                      {data.headToHead?.p1Wins ?? 0}W – {data.headToHead?.p2Wins ?? 0}L
                    </span>
                    <span className="text-xs font-sans text-purple-300 font-semibold" title="Head-to-head match record between these two players">
                      H2H Record
                    </span>
                    <span
                      className={`font-bold text-right ${
                        (data.headToHead?.p2Wins ?? 0) > (data.headToHead?.p1Wins ?? 0)
                          ? "text-purple-400 font-black"
                          : (data.headToHead?.p2Wins ?? 0) < (data.headToHead?.p1Wins ?? 0)
                          ? "text-slate-400"
                          : "text-slate-300"
                      }`}
                    >
                      {data.headToHead?.p2Wins ?? 0}W – {data.headToHead?.p1Wins ?? 0}L
                    </span>
                  </div>

                  {/* Win Rate */}
                  <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                    <span
                      className={`font-bold ${
                        data.player1.winRate >= data.player2.winRate
                          ? "text-emerald-400"
                          : "text-slate-300"
                      }`}
                    >
                      {data.player1.winRate}%
                    </span>
                    <span className="text-xs font-sans text-slate-400">Win Rate</span>
                    <span
                      className={`font-bold text-right ${
                        data.player2.winRate >= data.player1.winRate
                          ? "text-purple-400"
                          : "text-slate-300"
                      }`}
                    >
                      {data.player2.winRate}%
                    </span>
                  </div>

                  {/* Current Streak */}
                  <div className="py-2.5 px-4 flex items-center justify-between">
                    <span>
                      {data.player1.currentStreak > 0 ? (
                        <span className="text-amber-400 font-bold">
                          {data.player1.currentStreak}W 🔥
                        </span>
                      ) : data.player1.currentStreak < 0 ? (
                        <span className="text-slate-400 font-mono">
                          {Math.abs(data.player1.currentStreak)}L ❄️
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-xs text-slate-400">Active Streak</span>
                    <span className="text-right">
                      {data.player2.currentStreak > 0 ? (
                        <span className="text-amber-400 font-bold">
                          {data.player2.currentStreak}W 🔥
                        </span>
                      ) : data.player2.currentStreak < 0 ? (
                        <span className="text-slate-400 font-mono">
                          {Math.abs(data.player2.currentStreak)}L ❄️
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>

                  {/* Career Points Scoring & Differential */}
                  {(() => {
                    const p1PtsFor = data.player1.totalPointsFor ?? data.prediction?.careerPoints?.p1?.pointsFor ?? 0;
                    const p2PtsFor = data.player2.totalPointsFor ?? data.prediction?.careerPoints?.p2?.pointsFor ?? 0;
                    const p1PtsAgainst = data.player1.totalPointsAgainst ?? data.prediction?.careerPoints?.p1?.pointsAgainst ?? 0;
                    const p2PtsAgainst = data.player2.totalPointsAgainst ?? data.prediction?.careerPoints?.p2?.pointsAgainst ?? 0;
                    const p1Diff = data.player1.pointDifferential ?? (p1PtsFor - p1PtsAgainst);
                    const p2Diff = data.player2.pointDifferential ?? (p2PtsFor - p2PtsAgainst);

                    return (
                      <>
                        {/* Total Points For */}
                        <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                          <span
                            className={`font-bold ${
                              p1PtsFor >= p2PtsFor ? "text-emerald-400 font-black" : "text-slate-300"
                            }`}
                          >
                            {p1PtsFor}
                            {data.player1.avgPointsFor ? (
                              <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                                ({data.player1.avgPointsFor}/gm)
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs font-sans text-slate-400" title="Total career points scored across all recorded matches">
                            Total Points (For)
                          </span>
                          <span
                            className={`font-bold text-right ${
                              p2PtsFor >= p1PtsFor ? "text-purple-400 font-black" : "text-slate-300"
                            }`}
                          >
                            {p2PtsFor}
                            {data.player2.avgPointsFor ? (
                              <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                                ({data.player2.avgPointsFor}/gm)
                              </span>
                            ) : null}
                          </span>
                        </div>

                        {/* Total Points Against */}
                        <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                          <span
                            className={`font-bold ${
                              p1PtsAgainst <= p2PtsAgainst ? "text-emerald-400 font-black" : "text-slate-300"
                            }`}
                          >
                            {p1PtsAgainst}
                            {data.player1.avgPointsAgainst ? (
                              <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                                ({data.player1.avgPointsAgainst}/gm)
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs font-sans text-slate-400" title="Total career points conceded across all recorded matches (lower is better defense)">
                            Points Conceded (Against)
                          </span>
                          <span
                            className={`font-bold text-right ${
                              p2PtsAgainst <= p1PtsAgainst ? "text-purple-400 font-black" : "text-slate-300"
                            }`}
                          >
                            {p2PtsAgainst}
                            {data.player2.avgPointsAgainst ? (
                              <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                                ({data.player2.avgPointsAgainst}/gm)
                              </span>
                            ) : null}
                          </span>
                        </div>

                        {/* Point Differential */}
                        <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                          <span
                            className={`font-bold ${
                              p1Diff > 0
                                ? "text-emerald-400"
                                : p1Diff < 0
                                ? "text-rose-400"
                                : "text-slate-300"
                            }`}
                          >
                            {p1Diff > 0 ? `+${p1Diff}` : p1Diff}
                          </span>
                          <span className="text-xs font-sans text-slate-400" title="Net career point differential (Points For minus Points Against)">
                            Point Differential
                          </span>
                          <span
                            className={`font-bold text-right ${
                              p2Diff > 0
                                ? "text-purple-400"
                                : p2Diff < 0
                                ? "text-rose-400"
                                : "text-slate-300"
                            }`}
                          >
                            {p2Diff > 0 ? `+${p2Diff}` : p2Diff}
                          </span>
                        </div>

                        {/* Direct Head-to-Head Points (if played) */}
                        {data.headToHead?.matches?.length > 0 && (
                          <div className="py-2.5 px-4 flex items-center justify-between font-mono bg-purple-950/15 border-y border-purple-500/20">
                            <span
                              className={`font-bold ${
                                (data.headToHead.p1H2hPoints ?? 0) >= (data.headToHead.p2H2hPoints ?? 0)
                                  ? "text-emerald-400 font-black"
                                  : "text-slate-300"
                              }`}
                            >
                              {data.headToHead.p1H2hPoints ?? 0}
                              {data.headToHead.p1AvgPoints ? (
                                <span className="text-slate-400 text-xs ml-1 font-normal font-sans">
                                  ({data.headToHead.p1AvgPoints}/gm)
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs font-sans text-purple-300 font-semibold" title="Total points scored against each other in direct head-to-head matches">
                              H2H Points Scored
                            </span>
                            <span
                              className={`font-bold text-right ${
                                (data.headToHead.p2H2hPoints ?? 0) >= (data.headToHead.p1H2hPoints ?? 0)
                                  ? "text-purple-400 font-black"
                                  : "text-slate-300"
                              }`}
                            >
                              {data.headToHead.p2H2hPoints ?? 0}
                              {data.headToHead.p2AvgPoints ? (
                                <span className="text-slate-400 text-xs ml-1 font-normal font-sans">
                                  ({data.headToHead.p2AvgPoints}/gm)
                                </span>
                              ) : null}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Opponent Difficulty & Strength of Schedule */}
                  {data.prediction.opponentStrength && (
                    <>
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span className="text-slate-300">
                          {data.prediction.opponentStrength.p1.avgOpponentElo.toFixed(1)} ELO
                        </span>
                        <span className="text-xs font-sans text-slate-400" title="Average rating of opponents faced">
                          Opponent Difficulty
                        </span>
                        <span className="text-slate-300 text-right">
                          {data.prediction.opponentStrength.p2.avgOpponentElo.toFixed(1)} ELO
                        </span>
                      </div>

                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span className="text-slate-300">
                          {data.prediction.opponentStrength.p1.wins}W – {data.prediction.opponentStrength.p1.losses}L
                          <span className="text-slate-500 text-xs ml-1">
                            ({data.prediction.opponentStrength.p1.rawWinRate}%)
                          </span>
                        </span>
                        <span className="text-xs font-sans text-slate-400" title="Record against all other dorm players">
                          Record vs Others
                        </span>
                        <span className="text-slate-300 text-right">
                          {data.prediction.opponentStrength.p2.wins}W – {data.prediction.opponentStrength.p2.losses}L
                          <span className="text-slate-500 text-xs ml-1">
                            ({data.prediction.opponentStrength.p2.rawWinRate}%)
                          </span>
                        </span>
                      </div>

                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span
                          className={`font-bold ${
                            data.prediction.opponentStrength.p1.qualityScore >=
                            data.prediction.opponentStrength.p2.qualityScore
                              ? "text-emerald-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          {data.prediction.opponentStrength.p1.qualityScore.toFixed(0)}
                        </span>
                        <span className="text-xs font-sans text-slate-400" title="Win Rate adjusted by Opponent Difficulty">
                          Quality Index
                        </span>
                        <span
                          className={`font-bold text-right ${
                            data.prediction.opponentStrength.p2.qualityScore >=
                            data.prediction.opponentStrength.p1.qualityScore
                              ? "text-purple-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          {data.prediction.opponentStrength.p2.qualityScore.toFixed(0)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Dorm Room */}
                  <div className="py-2.5 px-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>{data.player1.roomNumber ? `Rm ${data.player1.roomNumber}` : "—"}</span>
                    <span className="font-sans">Room #</span>
                    <span className="text-right">
                      {data.player2.roomNumber ? `Rm ${data.player2.roomNumber}` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Head-to-Head Match History List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Swords className="w-4 h-4 text-slate-400" /> Past Battles Between These Two
                  </h3>
                  <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                    Series: <span className="text-emerald-400 font-bold">{data.headToHead.p1Wins}</span> – <span className="text-purple-400 font-bold">{data.headToHead.p2Wins}</span> ({data.headToHead.matches.length} total)
                  </span>
                </div>

                {data.headToHead.matches.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    These two players have not played any confirmed matches against each other yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {data.headToHead.matches.map((m: any) => {
                      const isP1Winner = m.winnerId === data.player1.id;
                      return (
                        <div
                          key={m.id}
                          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs hover:border-slate-700 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${
                                isP1Winner
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              }`}
                            >
                              {isP1Winner
                                ? `${data.player1.displayName} Won`
                                : `${data.player2.displayName} Won`}
                            </span>
                            <div>
                              <div className="font-semibold text-white">
                                {m.p1Score} – {m.p2Score}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{new Date(m.date).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{m.isGameTo11 ? "⚡ Game to 11" : "🏆 Game to 21"}</span>
                              </div>
                            </div>
                          </div>

                          {m.notes && (
                            <span className="text-[11px] text-slate-400 italic hidden sm:inline max-w-[180px] truncate">
                              "{m.notes}"
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
