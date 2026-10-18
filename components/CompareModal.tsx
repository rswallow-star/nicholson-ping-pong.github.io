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
  const [formatFilter, setFormatFilter] = useState<"all" | "21" | "11">("all");

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
          {/* Format Filter Dropdown */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Game Format:</span>
            </span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as "all" | "21" | "11")}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">⚡ Both Game Formats (All Games)</option>
              <option value="21">🏆 Games to 21 Only</option>
              <option value="11">⚡ Games to 11 Only</option>
            </select>
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
            (() => {
              const p1 = data.player1;
              const p2 = data.player2;

              // Filtered H2H matches list
              const allH2hMatches = data.headToHead?.matches || [];
              const filteredH2hMatches =
                formatFilter === "21"
                  ? allH2hMatches.filter((m: any) => !m.isGameTo11)
                  : formatFilter === "11"
                  ? allH2hMatches.filter((m: any) => m.isGameTo11)
                  : allH2hMatches;

              const h2hMatchesCount = filteredH2hMatches.length;

              const p1H2hWins =
                formatFilter === "21"
                  ? data.headToHead?.p1Wins21 ?? filteredH2hMatches.filter((m: any) => m.winnerId === p1.id).length
                  : formatFilter === "11"
                  ? data.headToHead?.p1Wins11 ?? filteredH2hMatches.filter((m: any) => m.winnerId === p1.id).length
                  : data.headToHead?.p1Wins ?? 0;

              const p2H2hWins =
                formatFilter === "21"
                  ? data.headToHead?.p2Wins21 ?? filteredH2hMatches.filter((m: any) => m.winnerId === p2.id).length
                  : formatFilter === "11"
                  ? data.headToHead?.p2Wins11 ?? filteredH2hMatches.filter((m: any) => m.winnerId === p2.id).length
                  : data.headToHead?.p2Wins ?? 0;

              // Win Probability based on format filter
              const winChanceP1 =
                formatFilter === "21"
                  ? data.prediction?.winChance21P1 ?? data.prediction?.winChanceP1
                  : formatFilter === "11"
                  ? data.prediction?.winChance11P1 ?? data.prediction?.winChanceP1
                  : data.prediction?.winChanceP1;

              const winChanceP2 =
                formatFilter === "21"
                  ? data.prediction?.winChance21P2 ?? data.prediction?.winChanceP2
                  : formatFilter === "11"
                  ? data.prediction?.winChance11P2 ?? data.prediction?.winChanceP2
                  : data.prediction?.winChanceP2;

              // Records by format
              const p1Wins =
                formatFilter === "21"
                  ? p1.games21?.wins ?? 0
                  : formatFilter === "11"
                  ? p1.games11?.wins ?? 0
                  : p1.wins;

              const p1Losses =
                formatFilter === "21"
                  ? p1.games21?.losses ?? 0
                  : formatFilter === "11"
                  ? p1.games11?.losses ?? 0
                  : p1.losses;

              const p2Wins =
                formatFilter === "21"
                  ? p2.games21?.wins ?? 0
                  : formatFilter === "11"
                  ? p2.games11?.wins ?? 0
                  : p2.wins;

              const p2Losses =
                formatFilter === "21"
                  ? p2.games21?.losses ?? 0
                  : formatFilter === "11"
                  ? p2.games11?.losses ?? 0
                  : p2.losses;

              // Win Rate by format
              const p1WinRate =
                formatFilter === "21"
                  ? p1.games21?.winRate ?? (p1Wins + p1Losses > 0 ? Math.round((p1Wins / (p1Wins + p1Losses)) * 1000) / 10 : 0)
                  : formatFilter === "11"
                  ? p1.games11?.winRate ?? (p1Wins + p1Losses > 0 ? Math.round((p1Wins / (p1Wins + p1Losses)) * 1000) / 10 : 0)
                  : p1.winRate;

              const p2WinRate =
                formatFilter === "21"
                  ? p2.games21?.winRate ?? (p2Wins + p2Losses > 0 ? Math.round((p2Wins / (p2Wins + p2Losses)) * 1000) / 10 : 0)
                  : formatFilter === "11"
                  ? p2.games11?.winRate ?? (p2Wins + p2Losses > 0 ? Math.round((p2Wins / (p2Wins + p2Losses)) * 1000) / 10 : 0)
                  : p2.winRate;

              // Points For & Against by format
              const p1PtsFor =
                formatFilter === "21"
                  ? p1.games21?.pointsFor ?? 0
                  : formatFilter === "11"
                  ? p1.games11?.pointsFor ?? 0
                  : p1.totalPointsFor ?? 0;

              const p2PtsFor =
                formatFilter === "21"
                  ? p2.games21?.pointsFor ?? 0
                  : formatFilter === "11"
                  ? p2.games11?.pointsFor ?? 0
                  : p2.totalPointsFor ?? 0;

              const p1PtsAgainst =
                formatFilter === "21"
                  ? p1.games21?.pointsAgainst ?? 0
                  : formatFilter === "11"
                  ? p1.games11?.pointsAgainst ?? 0
                  : p1.totalPointsAgainst ?? 0;

              const p2PtsAgainst =
                formatFilter === "21"
                  ? p2.games21?.pointsAgainst ?? 0
                  : formatFilter === "11"
                  ? p2.games11?.pointsAgainst ?? 0
                  : p2.totalPointsAgainst ?? 0;

              const p1Diff = p1PtsFor - p1PtsAgainst;
              const p2Diff = p2PtsFor - p2PtsAgainst;

              const p1Matches = p1Wins + p1Losses;
              const p2Matches = p2Wins + p2Losses;

              const p1DiffPerGame = p1Matches > 0 ? (p1Diff / p1Matches).toFixed(1) : "0.0";
              const p2DiffPerGame = p2Matches > 0 ? (p2Diff / p2Matches).toFixed(1) : "0.0";

              // 21-pt and 11-pt diffs per game
              const p1Matches21 = p1.games21?.matchesCount ?? ((p1.games21?.wins ?? 0) + (p1.games21?.losses ?? 0));
              const p2Matches21 = p2.games21?.matchesCount ?? ((p2.games21?.wins ?? 0) + (p2.games21?.losses ?? 0));
              const p1Diff21PerGame =
                p1.games21?.pointDiffPerGame ??
                p1.pointDiff21PerGame ??
                (p1Matches21 > 0 ? (((p1.games21?.pointsFor ?? 0) - (p1.games21?.pointsAgainst ?? 0)) / p1Matches21).toFixed(1) : "0.0");
              const p2Diff21PerGame =
                p2.games21?.pointDiffPerGame ??
                p2.pointDiff21PerGame ??
                (p2Matches21 > 0 ? (((p2.games21?.pointsFor ?? 0) - (p2.games21?.pointsAgainst ?? 0)) / p2Matches21).toFixed(1) : "0.0");

              const p1Matches11 = p1.games11?.matchesCount ?? ((p1.games11?.wins ?? 0) + (p1.games11?.losses ?? 0));
              const p2Matches11 = p2.games11?.matchesCount ?? ((p2.games11?.wins ?? 0) + (p2.games11?.losses ?? 0));
              const p1Diff11PerGame =
                p1.games11?.pointDiffPerGame ??
                p1.pointDiff11PerGame ??
                (p1Matches11 > 0 ? (((p1.games11?.pointsFor ?? 0) - (p1.games11?.pointsAgainst ?? 0)) / p1Matches11).toFixed(1) : "0.0");
              const p2Diff11PerGame =
                p2.games11?.pointDiffPerGame ??
                p2.pointDiff11PerGame ??
                (p2Matches11 > 0 ? (((p2.games11?.pointsFor ?? 0) - (p2.games11?.pointsAgainst ?? 0)) / p2Matches11).toFixed(1) : "0.0");

              // Separated format averages (never combined!)
              const p1Avg21For = p1.games21?.avgPointsFor ?? p1.avgPoints21For ?? "0.0";
              const p1Avg21Against = p1.games21?.avgPointsAgainst ?? p1.avgPoints21Against ?? "0.0";
              const p2Avg21For = p2.games21?.avgPointsFor ?? p2.avgPoints21For ?? "0.0";
              const p2Avg21Against = p2.games21?.avgPointsAgainst ?? p2.avgPoints21Against ?? "0.0";

              const p1Avg11For = p1.games11?.avgPointsFor ?? p1.avgPoints11For ?? "0.0";
              const p1Avg11Against = p1.games11?.avgPointsAgainst ?? p1.avgPoints11Against ?? "0.0";
              const p2Avg11For = p2.games11?.avgPointsFor ?? p2.avgPoints11For ?? "0.0";
              const p2Avg11Against = p2.games11?.avgPointsAgainst ?? p2.avgPoints11Against ?? "0.0";

              // Direct H2H points & diffs
              const p1H2hPts =
                formatFilter === "21"
                  ? data.headToHead?.p1Points21 ?? filteredH2hMatches.reduce((s: number, m: any) => s + m.p1Score, 0)
                  : formatFilter === "11"
                  ? data.headToHead?.p1Points11 ?? filteredH2hMatches.reduce((s: number, m: any) => s + m.p1Score, 0)
                  : data.headToHead?.p1H2hPoints ?? 0;

              const p2H2hPts =
                formatFilter === "21"
                  ? data.headToHead?.p2Points21 ?? filteredH2hMatches.reduce((s: number, m: any) => s + m.p2Score, 0)
                  : formatFilter === "11"
                  ? data.headToHead?.p2Points11 ?? filteredH2hMatches.reduce((s: number, m: any) => s + m.p2Score, 0)
                  : data.headToHead?.p2H2hPoints ?? 0;

              const p1H2hAvg = h2hMatchesCount > 0 ? (p1H2hPts / h2hMatchesCount).toFixed(1) : null;
              const p2H2hAvg = h2hMatchesCount > 0 ? (p2H2hPts / h2hMatchesCount).toFixed(1) : null;

              const p1H2hDiffPerGame =
                formatFilter === "21"
                  ? data.headToHead?.p1Diff21PerGame ?? (h2hMatchesCount > 0 ? ((p1H2hPts - p2H2hPts) / h2hMatchesCount).toFixed(1) : null)
                  : formatFilter === "11"
                  ? data.headToHead?.p1Diff11PerGame ?? (h2hMatchesCount > 0 ? ((p1H2hPts - p2H2hPts) / h2hMatchesCount).toFixed(1) : null)
                  : data.headToHead?.p1H2hDiffPerGame ?? (h2hMatchesCount > 0 ? ((p1H2hPts - p2H2hPts) / h2hMatchesCount).toFixed(1) : null);

              const p2H2hDiffPerGame =
                formatFilter === "21"
                  ? data.headToHead?.p2Diff21PerGame ?? (h2hMatchesCount > 0 ? ((p2H2hPts - p1H2hPts) / h2hMatchesCount).toFixed(1) : null)
                  : formatFilter === "11"
                  ? data.headToHead?.p2Diff11PerGame ?? (h2hMatchesCount > 0 ? ((p2H2hPts - p1H2hPts) / h2hMatchesCount).toFixed(1) : null)
                  : data.headToHead?.p2H2hDiffPerGame ?? (h2hMatchesCount > 0 ? ((p2H2hPts - p1H2hPts) / h2hMatchesCount).toFixed(1) : null);

              return (
                <>
                  {/* Prediction Centerpiece Banner */}
                  <div className="bg-gradient-to-br from-slate-950 via-slate-950/90 to-purple-950/20 border border-slate-800 rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Predicted Win Probability</span>
                        {formatFilter !== "all" && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono">
                            {formatFilter === "21" ? "Game to 21" : "Game to 11"}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-300 font-mono bg-slate-900/90 border border-slate-800 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="text-slate-400">
                          {formatFilter === "21" ? "21-pt H2H:" : formatFilter === "11" ? "11-pt H2H:" : "H2H:"}
                        </span>
                        <span className="text-emerald-400 font-bold">{p1H2hWins}</span>
                        <span className="text-slate-500">–</span>
                        <span className="text-purple-400 font-bold">{p2H2hWins}</span>
                        <span className="text-slate-500 text-[10px]">
                          ({h2hMatchesCount} mtg{h2hMatchesCount === 1 ? "" : "s"})
                        </span>
                      </span>
                    </div>

                    {/* Big Probabilities Display */}
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <div className="text-xs font-semibold text-emerald-400 truncate max-w-[150px] sm:max-w-none">
                          {p1.displayName}
                        </div>
                        <div className="text-3xl font-black font-mono text-white">
                          {winChanceP1}%
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
                        VS
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-semibold text-purple-400 truncate max-w-[150px] sm:max-w-none">
                          {p2.displayName}
                        </div>
                        <div className="text-3xl font-black font-mono text-white">
                          {winChanceP2}%
                        </div>
                      </div>
                    </div>

                    {/* Visual Ratio Progress Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex mb-3 shadow-inner">
                      <div
                        style={{ width: `${winChanceP1}%` }}
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                        title={`${p1.displayName}: ${winChanceP1}%`}
                      />
                      <div
                        style={{ width: `${winChanceP2}%` }}
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
                        title={`${p2.displayName}: ${winChanceP2}%`}
                      />
                    </div>

                    {/* Projected Match Score / Simulation Card */}
                    {data.prediction?.projectedMatch && (
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 my-3.5 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                            <Target className="w-3.5 h-3.5 text-emerald-400" /> Projected Match Score
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Score Distribution Model
                          </span>
                        </div>

                        <div className={`grid gap-3 ${formatFilter === "all" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                          {/* Game to 21 */}
                          {(formatFilter === "all" || formatFilter === "21") && (
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
                          )}

                          {/* Game to 11 */}
                          {(formatFilter === "all" || formatFilter === "11") && (
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
                          )}
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
                      <span className="text-emerald-400 truncate max-w-[120px]">{p1.displayName}</span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <span>Metric</span>
                        {formatFilter !== "all" && (
                          <span className="text-[10px] text-purple-400 font-normal">
                            ({formatFilter === "21" ? "21-pt" : "11-pt"})
                          </span>
                        )}
                      </span>
                      <span className="text-purple-400 truncate max-w-[120px] text-right">{p2.displayName}</span>
                    </div>

                    <div className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                      {/* Current ELO */}
                      <div className="py-3 px-4 flex items-center justify-between">
                        <span
                          className={`font-mono font-bold text-base ${
                            p1.currentElo >= p2.currentElo
                              ? "text-emerald-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          {p1.currentElo.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">Current ELO</span>
                        <span
                          className={`font-mono font-bold text-base text-right ${
                            p2.currentElo >= p1.currentElo
                              ? "text-purple-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          {p2.currentElo.toFixed(1)}
                        </span>
                      </div>

                      {/* Peak ELO */}
                      <div className="py-2.5 px-4 flex items-center justify-between">
                        <span className="font-mono text-slate-300">
                          {p1.peakElo.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-400">Peak ELO</span>
                        <span className="font-mono text-slate-300 text-right">
                          {p2.peakElo.toFixed(1)}
                        </span>
                      </div>

                      {/* Dorm Rank */}
                      <div className="py-2.5 px-4 flex items-center justify-between">
                        <span
                          className={`font-bold ${
                            p1.rank <= p2.rank
                              ? "text-amber-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          #{p1.rank}
                        </span>
                        <span className="text-xs text-slate-400">Dorm Rank</span>
                        <span
                          className={`font-bold text-right ${
                            p2.rank <= p1.rank
                              ? "text-amber-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          #{p2.rank}
                        </span>
                      </div>

                      {/* Match Record (filtered by format) */}
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span className="text-slate-300">
                          {p1Wins}W – {p1Losses}L
                        </span>
                        <span className="text-xs font-sans text-slate-400">
                          {formatFilter === "all" ? "Career Record" : formatFilter === "21" ? "21-pt Record" : "11-pt Record"}
                        </span>
                        <span className="text-slate-300 text-right">
                          {p2Wins}W – {p2Losses}L
                        </span>
                      </div>

                      {/* Head-to-Head Match Record (filtered by format) */}
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono bg-purple-950/15 border-y border-purple-500/20">
                        <span
                          className={`font-bold ${
                            p1H2hWins > p2H2hWins
                              ? "text-emerald-400 font-black"
                              : p1H2hWins < p2H2hWins
                              ? "text-slate-400"
                              : "text-slate-300"
                          }`}
                        >
                          {p1H2hWins}W – {p2H2hWins}L
                        </span>
                        <span className="text-xs font-sans text-purple-300 font-semibold" title="Head-to-head match record between these two players">
                          {formatFilter === "all" ? "H2H Record (All)" : formatFilter === "21" ? "H2H Record (21-pt)" : "H2H Record (11-pt)"}
                        </span>
                        <span
                          className={`font-bold text-right ${
                            p2H2hWins > p1H2hWins
                              ? "text-purple-400 font-black"
                              : p2H2hWins < p1H2hWins
                              ? "text-slate-400"
                              : "text-slate-300"
                          }`}
                        >
                          {p2H2hWins}W – {p1H2hWins}L
                        </span>
                      </div>

                      {/* Win Rate (filtered by format) */}
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span
                          className={`font-bold ${
                            p1WinRate >= p2WinRate
                              ? "text-emerald-400"
                              : "text-slate-300"
                          }`}
                        >
                          {p1WinRate}%
                        </span>
                        <span className="text-xs font-sans text-slate-400">
                          {formatFilter === "all" ? "Win Rate" : formatFilter === "21" ? "21-pt Win Rate" : "11-pt Win Rate"}
                        </span>
                        <span
                          className={`font-bold text-right ${
                            p2WinRate >= p1WinRate
                              ? "text-purple-400"
                              : "text-slate-300"
                          }`}
                        >
                          {p2WinRate}%
                        </span>
                      </div>

                      {/* Current Streak */}
                      {formatFilter === "all" && (
                        <div className="py-2.5 px-4 flex items-center justify-between">
                          <span>
                            {p1.currentStreak > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {p1.currentStreak}W 🔥
                              </span>
                            ) : p1.currentStreak < 0 ? (
                              <span className="text-slate-400 font-mono">
                                {Math.abs(p1.currentStreak)}L ❄️
                              </span>
                            ) : (
                              "—"
                            )}
                          </span>
                          <span className="text-xs text-slate-400">Active Streak</span>
                          <span className="text-right">
                            {p2.currentStreak > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {p2.currentStreak}W 🔥
                              </span>
                            ) : p2.currentStreak < 0 ? (
                              <span className="text-slate-400 font-mono">
                                {Math.abs(p2.currentStreak)}L ❄️
                              </span>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                      )}

                      {/* Points For (filtered by format) */}
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span
                          className={`font-bold ${
                            p1PtsFor >= p2PtsFor ? "text-emerald-400 font-black" : "text-slate-300"
                          }`}
                        >
                          {p1PtsFor}
                        </span>
                        <span className="text-xs font-sans text-slate-400">
                          {formatFilter === "all" ? "Total Points (For)" : formatFilter === "21" ? "21-pt Points (For)" : "11-pt Points (For)"}
                        </span>
                        <span
                          className={`font-bold text-right ${
                            p2PtsFor >= p1PtsFor ? "text-purple-400 font-black" : "text-slate-300"
                          }`}
                        >
                          {p2PtsFor}
                        </span>
                      </div>

                      {/* Points Against (filtered by format) */}
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span
                          className={`font-bold ${
                            p1PtsAgainst <= p2PtsAgainst ? "text-emerald-400 font-black" : "text-slate-300"
                          }`}
                        >
                          {p1PtsAgainst}
                        </span>
                        <span className="text-xs font-sans text-slate-400">
                          {formatFilter === "all" ? "Points Conceded (Against)" : formatFilter === "21" ? "21-pt Conceded" : "11-pt Conceded"}
                        </span>
                        <span
                          className={`font-bold text-right ${
                            p2PtsAgainst <= p1PtsAgainst ? "text-purple-400 font-black" : "text-slate-300"
                          }`}
                        >
                          {p2PtsAgainst}
                        </span>
                      </div>

                      {/* Point Differential (filtered by format) */}
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
                        <span className="text-xs font-sans text-slate-400">
                          {formatFilter === "all" ? "Point Differential" : formatFilter === "21" ? "21-pt Differential" : "11-pt Differential"}
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

                      {/* Point Differential Per Game (filtered by format) */}
                      <div className="py-2.5 px-4 flex items-center justify-between font-mono">
                        <span
                          className={`font-bold ${
                            parseFloat(p1DiffPerGame) > 0
                              ? "text-emerald-400 font-black"
                              : parseFloat(p1DiffPerGame) < 0
                              ? "text-rose-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          {parseFloat(p1DiffPerGame) > 0 ? `+${p1DiffPerGame}` : p1DiffPerGame}
                          <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                            / gm
                          </span>
                        </span>
                        <span className="text-xs font-sans text-slate-400 font-semibold" title="Average point differential per match played">
                          {formatFilter === "all" ? "Point Diff / Game" : formatFilter === "21" ? "21-pt Diff / Game" : "11-pt Diff / Game"}
                        </span>
                        <span
                          className={`font-bold text-right ${
                            parseFloat(p2DiffPerGame) > 0
                              ? "text-purple-400 font-black"
                              : parseFloat(p2DiffPerGame) < 0
                              ? "text-rose-400 font-black"
                              : "text-slate-300"
                          }`}
                        >
                          {parseFloat(p2DiffPerGame) > 0 ? `+${p2DiffPerGame}` : p2DiffPerGame}
                          <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                            / gm
                          </span>
                        </span>
                      </div>

                      {/* SEPARATED AVERAGE POINTS PER MATCH (NEVER COMBINED) */}
                      {(formatFilter === "all" || formatFilter === "21") && (
                        <div className="py-2.5 px-4 flex items-center justify-between font-mono bg-slate-900/40">
                          <span
                            className={`font-bold ${
                              parseFloat(p1Avg21For) >= parseFloat(p2Avg21For)
                                ? "text-emerald-400 font-black"
                                : "text-slate-300"
                            }`}
                          >
                            {p1Avg21For}
                            <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                              (conceded {p1Avg21Against}
                              {p1Matches21 > 0 ? `, ${parseFloat(p1Diff21PerGame) > 0 ? `+${p1Diff21PerGame}` : p1Diff21PerGame} diff` : ""})
                            </span>
                          </span>
                          <span className="text-xs font-sans text-purple-300 font-semibold flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-purple-400" /> Avg Points (21-pt Match)
                          </span>
                          <span
                            className={`font-bold text-right ${
                              parseFloat(p2Avg21For) >= parseFloat(p1Avg21For)
                                ? "text-purple-400 font-black"
                                : "text-slate-300"
                            }`}
                          >
                            {p2Avg21For}
                            <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                              (conceded {p2Avg21Against}
                              {p2Matches21 > 0 ? `, ${parseFloat(p2Diff21PerGame) > 0 ? `+${p2Diff21PerGame}` : p2Diff21PerGame} diff` : ""})
                            </span>
                          </span>
                        </div>
                      )}

                      {(formatFilter === "all" || formatFilter === "11") && (
                        <div className="py-2.5 px-4 flex items-center justify-between font-mono bg-slate-900/40">
                          <span
                            className={`font-bold ${
                              parseFloat(p1Avg11For) >= parseFloat(p2Avg11For)
                                ? "text-emerald-400 font-black"
                                : "text-slate-300"
                            }`}
                          >
                            {p1Avg11For}
                            <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                              (conceded {p1Avg11Against}
                              {p1Matches11 > 0 ? `, ${parseFloat(p1Diff11PerGame) > 0 ? `+${p1Diff11PerGame}` : p1Diff11PerGame} diff` : ""})
                            </span>
                          </span>
                          <span className="text-xs font-sans text-sky-300 font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3 text-sky-400" /> Avg Points (11-pt Match)
                          </span>
                          <span
                            className={`font-bold text-right ${
                              parseFloat(p2Avg11For) >= parseFloat(p1Avg11For)
                                ? "text-purple-400 font-black"
                                : "text-slate-300"
                            }`}
                          >
                            {p2Avg11For}
                            <span className="text-slate-500 text-xs ml-1 font-normal font-sans">
                              (conceded {p2Avg11Against}
                              {p2Matches11 > 0 ? `, ${parseFloat(p2Diff11PerGame) > 0 ? `+${p2Diff11PerGame}` : p2Diff11PerGame} diff` : ""})
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Head-to-Head Points Scored (when matches exist for the chosen format) */}
                      {h2hMatchesCount > 0 && (
                        <div className="py-2.5 px-4 flex items-center justify-between font-mono bg-purple-950/15 border-y border-purple-500/20">
                          <span
                            className={`font-bold ${
                              p1H2hPts >= p2H2hPts ? "text-emerald-400 font-black" : "text-slate-300"
                            }`}
                          >
                            {p1H2hPts}
                            {p1H2hAvg && (
                              <span className="text-slate-400 text-xs ml-1 font-normal font-sans">
                                ({p1H2hAvg}/gm
                                {p1H2hDiffPerGame !== null ? `, ${parseFloat(p1H2hDiffPerGame) > 0 ? `+${p1H2hDiffPerGame}` : p1H2hDiffPerGame} diff` : ""})
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-sans text-purple-300 font-semibold" title="Total points scored and differential in direct head-to-head matches for the selected format">
                            {formatFilter === "all" ? "H2H Points Scored" : formatFilter === "21" ? "21-pt H2H Points" : "11-pt H2H Points"}
                          </span>
                          <span
                            className={`font-bold text-right ${
                              p2H2hPts >= p1H2hPts ? "text-purple-400 font-black" : "text-slate-300"
                            }`}
                          >
                            {p2H2hPts}
                            {p2H2hAvg && (
                              <span className="text-slate-400 text-xs ml-1 font-normal font-sans">
                                ({p2H2hAvg}/gm
                                {p2H2hDiffPerGame !== null ? `, ${parseFloat(p2H2hDiffPerGame) > 0 ? `+${p2H2hDiffPerGame}` : p2H2hDiffPerGame} diff` : ""})
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Opponent Difficulty & Quality Index (shown in all view) */}
                      {formatFilter === "all" && data.prediction.opponentStrength && (
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
                            <span className="text-xs font-sans text-slate-400" title="Point Differential factored by Opponent Difficulty">
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
                        <span>{p1.roomNumber ? `Rm ${p1.roomNumber}` : "—"}</span>
                        <span className="font-sans">Room #</span>
                        <span className="text-right">
                          {p2.roomNumber ? `Rm ${p2.roomNumber}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Head-to-Head Match History List (filtered by format) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Swords className="w-4 h-4 text-slate-400" />
                        <span>Past Battles Between These Two</span>
                        {formatFilter !== "all" && (
                          <span className="text-xs text-purple-400 font-normal">
                            ({formatFilter === "21" ? "21-pt" : "11-pt"})
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                        Series: <span className="text-emerald-400 font-bold">{p1H2hWins}</span> – <span className="text-purple-400 font-bold">{p2H2hWins}</span> ({filteredH2hMatches.length} {formatFilter === "all" ? "total" : formatFilter === "21" ? "21-pt" : "11-pt"})
                      </span>
                    </div>

                    {filteredH2hMatches.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                        No {formatFilter === "all" ? "confirmed" : formatFilter === "21" ? "21-point" : "11-point"} matches played between these two players yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {filteredH2hMatches.map((m: any) => {
                          const isP1Winner = m.winnerId === p1.id;
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
                                    ? `${p1.displayName} Won`
                                    : `${p2.displayName} Won`}
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
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
