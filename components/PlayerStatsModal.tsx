"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Flame,
  TrendingUp,
  X,
  Target,
  Zap,
  Award,
  Calendar,
  Swords,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface PlayerStatsModalProps {
  playerId: string;
  onClose: () => void;
}

type RangeToggle = "5" | "10" | "20" | "50" | "all";

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({
  playerId,
  onClose,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRange, setSelectedRange] = useState<RangeToggle>("all");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/players/${playerId}`);
        if (!res.ok) {
          throw new Error("Failed to load player stats.");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId]);

  // Filter chart data based on selected range
  const getFilteredChartData = () => {
    if (!data || !data.chartData || data.chartData.length === 0) return [];
    const all = data.chartData;
    if (selectedRange === "all") return all;

    const count = parseInt(selectedRange, 10);
    // Keep at least the starting reference point or last N games
    if (all.length <= count) return all;
    return all.slice(all.length - count);
  };

  const filteredChart = getFilteredChartData();

  // Find min and max for the chart Y-axis scale with padding
  const eloValues = filteredChart.map((d: any) => d.elo);
  const minElo = eloValues.length > 0 ? Math.floor(Math.min(...eloValues) - 25) : 1100;
  const maxElo = eloValues.length > 0 ? Math.ceil(Math.max(...eloValues) + 25) : 1300;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700"
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Loading player career stats...
          </div>
        ) : error || !data ? (
          <div className="py-16 text-center text-rose-400 text-sm">
            {error || "Could not retrieve stats."}
          </div>
        ) : (
          <div className="overflow-y-auto pr-1 space-y-6">
            {/* Header: Player Identity & Big ELO Badge */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> Dorm Rank #{data.player.rank}
                  </span>
                  {data.player.roomNumber && (
                    <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                      Room {data.player.roomNumber}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {data.player.displayName}
                </h2>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Resident registered on {new Date(data.player.registeredAt).toLocaleDateString()}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Current Rating
                </div>
                <div className="text-3xl font-black font-mono text-emerald-400">
                  {data.player.currentElo.toFixed(1)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Peak: <strong className="text-slate-300">{data.player.peakElo.toFixed(1)}</strong>
                </div>
              </div>
            </div>

            {/* Quick KPI Stat Cards (4-Grid) */}
            {(() => {
              const g21Total = data.analytics.gamesTo21.wins + data.analytics.gamesTo21.losses;
              const g21Pct = g21Total > 0 ? Math.round((data.analytics.gamesTo21.wins / g21Total) * 100) : 0;

              const g11Total = data.analytics.gamesTo11.wins + data.analytics.gamesTo11.losses;
              const g11Pct = g11Total > 0 ? Math.round((data.analytics.gamesTo11.wins / g11Total) * 100) : 0;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Card 1: Overall Record */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-xs font-medium">Overall Record</span>
                      <Target className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-xl font-black font-mono text-white">
                      {data.player.wins}W – {data.player.losses}L
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      <strong className="text-emerald-400">{data.player.winRate}%</strong> Win Rate ({data.player.matchesPlayed} games)
                    </div>
                  </div>

                  {/* Card 2: Streak */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-xs font-medium">Streak</span>
                      <Flame className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-xl font-black font-mono text-white">
                      {data.player.currentStreak > 0 ? (
                        <span className="text-amber-400">{data.player.currentStreak}W 🔥</span>
                      ) : data.player.currentStreak < 0 ? (
                        <span className="text-slate-400">{Math.abs(data.player.currentStreak)}L ❄️</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {data.player.currentStreak > 0 ? "Active Win Streak" : "Current Form"}
                    </div>
                  </div>

                  {/* Card 3: Games to 21 */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-xs font-medium">Games to 21</span>
                      <Trophy className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-xl font-black font-mono text-purple-300">
                      {data.analytics.gamesTo21.wins}W – {data.analytics.gamesTo21.losses}L
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {g21Pct}% Win Rate ({g21Total} matches)
                    </div>
                  </div>

                  {/* Card 4: Games to 11 */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-xs font-medium">Games to 11</span>
                      <Zap className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="text-xl font-black font-mono text-sky-300">
                      {data.analytics.gamesTo11.wins}W – {data.analytics.gamesTo11.losses}L
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {g11Pct}% Win Rate ({g11Total} matches)
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Interactive ELO Progression Graph */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">ELO Rating Progression</h3>
                </div>

                {/* Range Selector Toggles */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                  {(["5", "10", "20", "50", "all"] as RangeToggle[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRange(r)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        selectedRange === r
                          ? "bg-emerald-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {r === "all" ? "All Time" : `Last ${r}`}
                    </button>
                  ))}
                </div>
              </div>

              {filteredChart.length < 2 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  Play more confirmed matches to plot the historical ELO curve.
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={filteredChart}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="eloGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[minElo, maxElo]}
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-xl text-xs space-y-1">
                                <div className="font-bold text-white flex items-center justify-between gap-3">
                                  <span>{p.label === "Start" ? "Account Initial" : `Game ${p.gameIndex}`}</span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    {p.elo} ELO
                                  </span>
                                </div>
                                {p.opponent && (
                                  <div className="text-slate-400 text-[11px]">
                                    vs {p.opponent}
                                  </div>
                                )}
                                {p.delta !== 0 && (
                                  <div
                                    className={`font-mono font-bold text-[11px] ${
                                      p.delta > 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {p.delta > 0 ? `+${p.delta}` : p.delta} pts
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="elo"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#eloGradient)"
                        dot={{ r: 3, fill: "#10b981" }}
                        activeDot={{ r: 5, fill: "#34d399" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent Match Log Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Swords className="w-4 h-4 text-slate-400" /> Recent Confirmed Match Log
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {data.recentMatches.length} games recorded
                </span>
              </div>

              {data.recentMatches.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  No confirmed matches logged yet for this player.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {data.recentMatches.map((m: any) => (
                    <div
                      key={m.id}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${
                            m.isWin
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {m.isWin ? "WIN" : "LOSS"}
                        </span>
                        <div>
                          <div className="font-semibold text-white">
                            vs {m.opponentName}
                            {m.opponentRoom && (
                              <span className="text-slate-500 font-normal ml-1">
                                (Rm {m.opponentRoom})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{new Date(m.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="font-mono">
                              {m.isGameTo11 ? "⚡ Game to 11" : "🏆 Game to 21"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right font-mono">
                          <div className="font-black text-white text-sm">
                            {m.myScore} – {m.theirScore}
                          </div>
                          {m.delta !== null && (
                            <div
                              className={`text-[11px] font-bold ${
                                m.delta > 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {m.delta > 0 ? `+${m.delta}` : m.delta}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
