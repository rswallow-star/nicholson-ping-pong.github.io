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
  Pencil,
  Trash2,
  Check,
  Sparkles,
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
  onPlayerUpdated?: () => void;
}

type RangeToggle = "5" | "10" | "20" | "50" | "all";

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({
  playerId,
  onClose,
  onPlayerUpdated,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRange, setSelectedRange] = useState<RangeToggle>("all");

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [editError, setEditError] = useState("");

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

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      setEditError("Player name cannot be empty.");
      return;
    }
    setSaveLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editName.trim(),
          roomNumber: editRoom.trim() || null,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to update player.");
      }
      setData((prev: any) => ({
        ...prev,
        player: {
          ...prev.player,
          displayName: editName.trim(),
          roomNumber: editRoom.trim() || null,
        },
      }));
      setIsEditing(false);
      if (onPlayerUpdated) onPlayerUpdated();
    } catch (err: any) {
      setEditError(err.message || "Failed to update.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${data.player.displayName}? This will also remove their match records and cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: "DELETE" });
      if (res.ok) {
        if (onPlayerUpdated) onPlayerUpdated();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete player.");
      }
    } catch (err) {
      alert("Error deleting player.");
    }
  };

  // Accurately compute the player's peak all-time win streak:
  // Combines backend calculations, active streak, and chronological replay of all confirmed matches
  const getAccuratePeakStreak = (): number => {
    if (!data) return 0;
    let max = 0;
    if (typeof data.player?.highestWinStreak === "number") {
      max = Math.max(max, data.player.highestWinStreak);
    }
    if (typeof data.player?.peakWinStreak === "number") {
      max = Math.max(max, data.player.peakWinStreak);
    }
    if (typeof data.analytics?.highestWinStreak === "number") {
      max = Math.max(max, data.analytics.highestWinStreak);
    }
    if (typeof data.player?.currentStreak === "number" && data.player.currentStreak > 0) {
      max = Math.max(max, data.player.currentStreak);
    }

    if (Array.isArray(data.recentMatches) && data.recentMatches.length > 0) {
      const sorted = [...data.recentMatches].sort(
        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      let run = 0;
      for (const m of sorted) {
        if (m.isWin) {
          run++;
          if (run > max) max = run;
        } else {
          run = 0;
        }
      }
    }
    return max;
  };

  const peakWinStreak = getAccuratePeakStreak();

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
                  {data.player.roomNumber && !isEditing && (
                    <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                      Room {data.player.roomNumber}
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Player Name"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editRoom}
                        onChange={(e) => setEditRoom(e.target.value)}
                        placeholder="Room (e.g. 304B)"
                        className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    {editError && (
                      <p className="text-xs text-rose-400 font-medium">{editError}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saveLoading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-md transition flex items-center gap-1 shadow-md shadow-emerald-600/30"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {saveLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-md transition border border-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeletePlayer}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 ml-3 hover:underline"
                        title="Delete this player from the database"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      {data.player.displayName}
                    </h2>
                    <button
                      onClick={() => {
                        setEditName(data.player.displayName);
                        setEditRoom(data.player.roomNumber || "");
                        setIsEditing(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border border-slate-700/60 transition"
                      title="Edit player name or room number"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
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
                <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                  <div>
                    Peak ELO: <strong className="text-slate-200">{data.player.peakElo.toFixed(1)}</strong>
                  </div>
                  <div>
                    Highest Streak:{" "}
                    <strong className="text-amber-400">
                      {peakWinStreak > 0 ? `${peakWinStreak}W 🔥` : "0W"}
                    </strong>
                  </div>
                  <div>
                    Quality Index:{" "}
                    <strong className="text-purple-400 font-bold">
                      {(data.player.qualityIndex ?? data.analytics?.qualityIndex ?? 0).toFixed(1)}
                    </strong>
                  </div>
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
                    <div className="text-[11px] font-mono space-y-0.5">
                      <div className="text-slate-400">
                        {data.player.currentStreak > 0 ? "Active" : "Current"}
                      </div>
                      <div className="text-amber-400 font-bold">
                        <span className="text-slate-400 font-normal">Peak: </span>
                        {peakWinStreak > 0 ? `${peakWinStreak}W 🔥` : "0W"}
                      </div>
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
                    {data.analytics.gamesTo21.avgPointsScored && (
                      <div className="text-[10px] text-purple-400 font-mono mt-0.5">
                        Avg: {data.analytics.gamesTo21.avgPointsScored} pts / gm
                      </div>
                    )}
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
                    {data.analytics.gamesTo11.avgPointsScored && (
                      <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                        Avg: {data.analytics.gamesTo11.avgPointsScored} pts / gm
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Career Points Scoring Card */}
            {(() => {
              const ptsFor =
                data.player?.totalPointsFor ??
                data.analytics?.totalPointsFor ??
                data.recentMatches?.reduce((sum: number, m: any) => sum + (m.myScore || 0), 0) ??
                0;
              const ptsAgainst =
                data.player?.totalPointsAgainst ??
                data.analytics?.totalPointsAgainst ??
                data.recentMatches?.reduce((sum: number, m: any) => sum + (m.theirScore || 0), 0) ??
                0;
              const pointDiff = ptsFor - ptsAgainst;

              // Separate format averages
              const recent21 = Array.isArray(data.recentMatches)
                ? data.recentMatches.filter((m: any) => !m.isGameTo11)
                : [];
              const recent11 = Array.isArray(data.recentMatches)
                ? data.recentMatches.filter((m: any) => m.isGameTo11)
                : [];

              const count21 =
                data.analytics?.gamesTo21 ? data.analytics.gamesTo21.wins + data.analytics.gamesTo21.losses : recent21.length;
              const count11 =
                data.analytics?.gamesTo11 ? data.analytics.gamesTo11.wins + data.analytics.gamesTo11.losses : recent11.length;

              const pts21For =
                data.analytics?.gamesTo21?.pointsScored ??
                recent21.reduce((sum: number, m: any) => sum + (m.myScore || 0), 0);
              const pts21Against =
                data.analytics?.gamesTo21?.pointsConceded ??
                recent21.reduce((sum: number, m: any) => sum + (m.theirScore || 0), 0);

              const pts11For =
                data.analytics?.gamesTo11?.pointsScored ??
                recent11.reduce((sum: number, m: any) => sum + (m.myScore || 0), 0);
              const pts11Against =
                data.analytics?.gamesTo11?.pointsConceded ??
                recent11.reduce((sum: number, m: any) => sum + (m.theirScore || 0), 0);

              const avg21For =
                data.player?.avgPoints21Scored ??
                (count21 > 0 ? (pts21For / count21).toFixed(1) : "—");
              const avg21Against =
                data.player?.avgPoints21Conceded ??
                (count21 > 0 ? (pts21Against / count21).toFixed(1) : "—");

              const avg11For =
                data.player?.avgPoints11Scored ??
                (count11 > 0 ? (pts11For / count11).toFixed(1) : "—");
              const avg11Against =
                data.player?.avgPoints11Conceded ??
                (count11 > 0 ? (pts11Against / count11).toFixed(1) : "—");

              return (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-400">Career Points</div>
                      <div className="text-lg font-black font-mono text-white flex items-center gap-2">
                        <span className="text-emerald-400">{ptsFor} For</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">{ptsAgainst} Against</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <div className="text-slate-500 text-[11px]">Differential</div>
                      <div className={`text-base font-black ${pointDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {pointDiff > 0 ? `+${pointDiff}` : pointDiff} pts
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                    <div className="text-right">
                      <div className="text-purple-400 text-[11px] font-semibold flex items-center gap-1 justify-end">
                        <Trophy className="w-3 h-3" /> 21-pt Match Avg
                      </div>
                      <div className="text-slate-200 font-bold">
                        {avg21For !== "—" ? `${avg21For} scored / ${avg21Against} conceded` : "No 21-pt games"}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                    <div className="text-right">
                      <div className="text-sky-400 text-[11px] font-semibold flex items-center gap-1 justify-end">
                        <Zap className="w-3 h-3" /> 11-pt Match Avg
                      </div>
                      <div className="text-slate-200 font-bold">
                        {avg11For !== "—" ? `${avg11For} scored / ${avg11Against} conceded` : "No 11-pt games"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Opponent Quality & Quality Index Card */}
            {(() => {
              const qualityIndex =
                data.player?.qualityIndex ?? data.analytics?.qualityIndex ?? 0;
              const avgOpponent =
                data.player?.avgOpponentElo ?? data.analytics?.avgOpponentElo ?? 1200;
              const pointDiff =
                data.player?.pointDifferential ?? data.analytics?.pointDifferential ?? 0;
              const highestDefeatedObj =
                data.analytics?.highestEloDefeated ?? data.player?.highestEloDefeated;
              const peakEloDefeated =
                typeof highestDefeatedObj === "object" && highestDefeatedObj !== null
                  ? highestDefeatedObj.elo
                  : typeof highestDefeatedObj === "number"
                  ? highestDefeatedObj
                  : null;
              const peakDefeatedName =
                typeof highestDefeatedObj === "object" && highestDefeatedObj !== null
                  ? highestDefeatedObj.name
                  : null;

              return (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-bold text-white">Opponent Quality & Index</h4>
                      <span className="text-[10px] bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-mono font-semibold">
                        Strength Metric
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-md">
                      Quality Index factors game-by-game point differentials with opponent difficulty: <span className="text-slate-300 font-mono">(Point Diff × Opponent ELO)</span>.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <div className="text-purple-400 text-[11px] font-semibold">Quality Index</div>
                      <div className="text-xl font-black text-purple-300">
                        {Number(qualityIndex).toFixed(1)}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                    <div className="text-right">
                      <div className="text-slate-500 text-[11px]">Avg Opponent ELO</div>
                      <div className="text-sm font-bold text-slate-200">
                        {Number(avgOpponent).toFixed(1)}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                    <div className="text-right">
                      <div className="text-slate-500 text-[11px]">Point Diff</div>
                      <div className={`text-sm font-bold ${pointDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {pointDiff > 0 ? `+${pointDiff}` : pointDiff} pts
                      </div>
                    </div>
                    {peakEloDefeated != null && !isNaN(Number(peakEloDefeated)) && (
                      <>
                        <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                        <div className="text-right">
                          <div className="text-slate-500 text-[11px]">Peak Defeat</div>
                          <div className="text-sm font-bold text-amber-300">
                            {Number(peakEloDefeated).toFixed(1)} ELO
                          </div>
                          {peakDefeatedName && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[110px]" title={`Defeated ${peakDefeatedName}`}>
                              vs {peakDefeatedName}
                            </div>
                          )}
                        </div>
                      </>
                    )}
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
