"use client";

import React, { useEffect, useState } from "react";
import {
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Swords,
  PlusCircle,
  UserPlus,
  Sparkles,
  ShieldAlert,
  Search,
  RefreshCw,
  Zap,
  Pencil,
} from "lucide-react";
import { PlayerStatsModal } from "@/components/PlayerStatsModal";
import { CompareModal } from "@/components/CompareModal";
import { EditMatchModal } from "@/components/EditMatchModal";

interface Player {
  id: string;
  displayName: string;
  roomNumber: string | null;
  rating: {
    currentElo: number;
    peakElo: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    currentStreak: number;
  } | null;
}

interface Match {
  id: string;
  submitterId: string;
  opponentId: string;
  submitterScore: number;
  opponentScore: number;
  status: string;
  notes: string | null;
  createdAt: string;
  submitter: { id: string; displayName: string; roomNumber: string | null };
  opponent: { id: string; displayName: string; roomNumber: string | null };
}

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedEditMatchId, setSelectedEditMatchId] = useState<string | null>(null);

  // Full match history state
  const [showAllRecentMatches, setShowAllRecentMatches] = useState(false);
  const [allMatchesList, setAllMatchesList] = useState<Match[]>([]);
  const [loadingAllMatches, setLoadingAllMatches] = useState(false);

  // Match Form State
  const [gameType, setGameType] = useState<11 | 21>(21);
  const [submitterId, setSubmitterId] = useState("");
  const [opponentId, setOpponentId] = useState("");
  const [submitterScore, setSubmitterScore] = useState("21");
  const [opponentScore, setOpponentScore] = useState("18");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Add Player Form State
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRoom, setNewPlayerRoom] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [playerFormError, setPlayerFormError] = useState("");

  const fetchAllMatches = async () => {
    try {
      setLoadingAllMatches(true);
      const res = await fetch("/api/matches?status=CONFIRMED&limit=200");
      if (res.ok) {
        const data = await res.json();
        setAllMatchesList(data.matches || []);
      }
    } catch (err) {
      console.error("Failed to load all matches:", err);
    } finally {
      setLoadingAllMatches(false);
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
        setPendingMatches(data.pendingMatches || []);
        setRecentMatches(data.recentMatches || []);
      }
      if (showAllRecentMatches) {
        fetchAllMatches();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleGameType = (type: 11 | 21) => {
    setGameType(type);
    if (type === 11) {
      setSubmitterScore("11");
      setOpponentScore("9");
    } else {
      setSubmitterScore("21");
      setOpponentScore("18");
    }
  };

  const handleSeed = async () => {
    setActionLoading("seed");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlayerFormError("");

    if (!newPlayerName.trim()) {
      setPlayerFormError("Please enter the player's name.");
      return;
    }

    setActionLoading("createPlayer");
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newPlayerName,
          roomNumber: newPlayerRoom,
          email: newPlayerEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPlayerFormError(data.error || "Failed to add player.");
      } else {
        setNewPlayerName("");
        setNewPlayerRoom("");
        setNewPlayerEmail("");
        setShowAddPlayerModal(false);
        await fetchData();
      }
    } catch (err) {
      setPlayerFormError("An unexpected error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmMatch = async (matchId: string) => {
    setActionLoading(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to confirm match.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    setActionLoading(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}/reject`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reject match.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!submitterId || !opponentId) {
      setFormError("Please select both players.");
      return;
    }
    if (submitterId === opponentId) {
      setFormError("Submitter and Opponent must be different players.");
      return;
    }

    setActionLoading("submit");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterId,
          opponentId,
          submitterScore,
          opponentScore,
          notes,
          gameType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to submit match.");
      } else {
        setShowLogModal(false);
        setNotes("");
        await fetchData();
      }
    } catch (err) {
      setFormError("An unexpected error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPlayers = players.filter(
    (p) =>
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (p.roomNumber && p.roomNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-xl">
              🏓
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Nicholson Pong <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ELO LADDER</span>
              </h1>
              <p className="text-xs text-slate-400">Nicholson Dorm Official Table Tennis League</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCompareModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg border border-slate-700 transition"
            >
              <Swords className="w-4 h-4 text-purple-400" /> Compare
            </button>

            <button
              onClick={() => setShowAddPlayerModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg border border-slate-700 transition"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" /> Add Player
            </button>

            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg transition-all shadow-md shadow-emerald-600/30 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" /> Log Match
            </button>

            {players.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={actionLoading === "seed"}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {actionLoading === "seed" ? "Seeding..." : "Seed Demo Players"}
              </button>
            )}

            <button
              onClick={fetchData}
              title="Refresh Leaderboard"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Pending Match Confirmations Banner */}
        {pendingMatches.length > 0 && (
          <section className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
              <h2 className="text-base font-bold text-amber-300">
                Matches Awaiting Opponent Confirmation ({pendingMatches.length})
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Submitted matches remain pending and do not affect ELO ratings until confirmed by the opponent.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingMatches.map((m) => {
                const isGameTo11 =
                  (m.notes && m.notes.includes("[Game to 11]")) ||
                  Math.max(m.submitterScore, m.opponentScore) <= 14;

                return (
                  <div
                    key={m.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="flex items-center gap-2">
                          Submitted by <strong className="text-white">{m.submitter.displayName}</strong>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              isGameTo11
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            }`}
                          >
                            {isGameTo11 ? "⚡ Game to 11" : "🏆 Game to 21 (x1.1 ELO)"}
                          </span>
                        </span>
                        <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                          PENDING
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-y border-slate-800/60 my-2">
                        <div>
                          <div className="text-sm font-bold text-white">{m.submitter.displayName}</div>
                          <div className="text-xs text-slate-500">Room {m.submitter.roomNumber || "N/A"}</div>
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-400">
                          {m.submitterScore} – {m.opponentScore}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">{m.opponent.displayName}</div>
                          <div className="text-xs text-slate-500">Room {m.opponent.roomNumber || "N/A"}</div>
                        </div>
                      </div>

                      {m.notes && (
                        <p className="text-xs text-slate-400 italic mb-3">"{m.notes}"</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleConfirmMatch(m.id)}
                        disabled={actionLoading === m.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 rounded-lg transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {actionLoading === m.id ? "Recalculating..." : "Accept & Update ELO"}
                      </button>
                      <button
                        onClick={() => setSelectedEditMatchId(m.id)}
                        className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-700 transition"
                        title="Edit game scores or details"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleRejectMatch(m.id)}
                        disabled={actionLoading === m.id}
                        className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 text-xs px-3 py-2 rounded-lg border border-slate-700 transition"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Live Leaderboard Section */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Nicholson Dorm Standings</h2>
              <span className="text-xs text-slate-400">({players.length} registered players)</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search player or room..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={() => setShowAddPlayerModal(true)}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
              >
                + Add Player
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4 text-right">ELO Rating</th>
                  <th className="py-3 px-4 text-center">W - L</th>
                  <th className="py-3 px-4 text-center">Win Rate</th>
                  <th className="py-3 px-4 text-center">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      {loading ? (
                        "Loading standings..."
                      ) : players.length === 0 ? (
                        <div className="space-y-4 max-w-sm mx-auto">
                          <p className="text-slate-400">No players registered yet in Nicholson Dorm.</p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => setShowAddPlayerModal(true)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                            >
                              + Add First Player
                            </button>
                            <button
                              onClick={handleSeed}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2 rounded-lg transition border border-slate-700"
                            >
                              ⚡ Seed Demo Players
                            </button>
                          </div>
                        </div>
                      ) : (
                        "No players match your search filter."
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, idx) => {
                    const r = player.rating;
                    const elo = r ? r.currentElo : 1200;
                    const wins = r ? r.wins : 0;
                    const losses = r ? r.losses : 0;
                    const total = wins + losses;
                    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
                    const streak = r ? r.currentStreak : 0;
                    const isProvisional = total < 10;

                    return (
                      <tr
                        key={player.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3.5 px-4 text-center font-bold">
                          {idx === 0 ? (
                            <span className="text-amber-400 text-lg">🥇 1</span>
                          ) : idx === 1 ? (
                            <span className="text-slate-300 text-base">🥈 2</span>
                          ) : idx === 2 ? (
                            <span className="text-amber-600 text-base">🥉 3</span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setSelectedPlayerId(player.id)}
                            className="font-semibold text-white hover:text-emerald-400 flex items-center gap-2 group transition text-left cursor-pointer"
                            title="Click to view full player stats & ELO graph"
                          >
                            <span className="group-hover:underline underline-offset-2">
                              {player.displayName}
                            </span>
                            {isProvisional && (
                              <span
                                title="Under 10 matches played (Dynamic K=48)"
                                className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30 font-mono"
                              >
                                PROVISIONAL
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                          {player.roomNumber ? `Rm ${player.roomNumber}` : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-base text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                            {elo.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-300">
                          <strong className="text-emerald-400">{wins}</strong>W –{" "}
                          <strong className="text-rose-400">{losses}</strong>L
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-300">
                          {winRate}%
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {streak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <Flame className="w-3.5 h-3.5 fill-amber-400" /> {streak}W
                            </span>
                          ) : streak < 0 ? (
                            <span className="text-xs text-slate-500 font-mono">
                              {Math.abs(streak)}L
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Confirmed Matches */}
        {(recentMatches.filter((rm) => rm.status === "CONFIRMED").length > 0 || allMatchesList.length > 0) && (
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Swords className="w-4 h-4 text-slate-400" />
                {showAllRecentMatches ? "All Confirmed Game History" : "Recent Confirmed Games"}
              </h3>
              <button
                onClick={() => {
                  const nextState = !showAllRecentMatches;
                  setShowAllRecentMatches(nextState);
                  if (nextState && allMatchesList.length === 0) {
                    fetchAllMatches();
                  }
                }}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20"
              >
                {loadingAllMatches
                  ? "Loading..."
                  : showAllRecentMatches
                  ? "Show Recent 10 Only"
                  : "View Full Match History"}
              </button>
            </div>
            <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto pr-1">
              {(showAllRecentMatches
                ? allMatchesList
                : recentMatches.filter((rm) => rm.status === "CONFIRMED")
              ).map((rm) => {
                const is11 =
                  (rm.notes && rm.notes.includes("[Game to 11]")) ||
                  Math.max(rm.submitterScore, rm.opponentScore) <= 14;

                return (
                  <div
                    key={rm.id}
                    className="py-3 flex items-center justify-between text-xs flex-wrap gap-2 hover:bg-slate-800/20 px-2 rounded-lg transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(rm.createdAt).toLocaleDateString()}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          is11
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        }`}
                      >
                        {is11 ? "11" : "21"}
                      </span>
                      <span className="font-semibold text-white">
                        {rm.submitter.displayName} vs {rm.opponent.displayName}
                      </span>
                      {rm.notes && (
                        <span className="text-slate-500 italic hidden sm:inline text-[11px]">
                          — "{rm.notes.replace(/\[Game to \d+\]\s*/g, "")}"
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded">
                        {rm.submitterScore} - {rm.opponentScore}
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                        ✓ Confirmed
                      </span>
                      <button
                        onClick={() => setSelectedEditMatchId(rm.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition border border-transparent hover:border-slate-700"
                        title="Edit Game Scores or Details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Register Nicholson Player
              </h2>
              <button
                onClick={() => setShowAddPlayerModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Add a dorm resident to the Nicholson ping-pong league. New players start with a baseline ELO rating of <strong>1200.0</strong>.
            </p>

            {playerFormError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {playerFormError}
              </div>
            )}

            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name / Nickname *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milo Palmer"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dorm Room Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 401A"
                  value={newPlayerRoom}
                  onChange={(e) => setNewPlayerRoom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  School / Contact Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. mpalmer@school.edu"
                  value={newPlayerEmail}
                  onChange={(e) => setNewPlayerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "createPlayer"}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition shadow-lg shadow-emerald-600/30"
                >
                  {actionLoading === "createPlayer" ? "Adding..." : "Add Player"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Match Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-emerald-400" /> Log Ping-Pong Match
              </h2>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {/* Game Type Selection Tabs */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Match Format
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleToggleGameType(21)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                    gameType === 21
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" /> Full Game (to 21)
                  <span className="text-[10px] bg-purple-950 px-1 py-0.2 rounded text-purple-200">
                    1.1x ELO
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleGameType(11)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                    gameType === 11
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" /> Quick Game (to 11)
                  <span className="text-[10px] bg-sky-950 px-1 py-0.2 rounded text-sky-200">
                    0.85x ELO
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {gameType === 21
                  ? "🏆 Full matches to 21 have +30% higher ELO weight due to lower luck variance and higher stamina."
                  : "⚡ Quick matches to 11 are faster with slightly reduced ELO stakes."}
              </p>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {formError}
              </div>
            )}

            <form onSubmit={handleSubmitMatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Player 1 (You / Submitter)
                </label>
                <select
                  value={submitterId}
                  onChange={(e) => setSubmitterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Select Submitter</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} {p.roomNumber ? `(Rm ${p.roomNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Player 2 (Opponent - Must Confirm)
                </label>
                <select
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Select Opponent</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} {p.roomNumber ? `(Rm ${p.roomNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Player 1 Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={submitterScore}
                    onChange={(e) => setSubmitterScore(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center font-mono font-bold text-lg text-emerald-400 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Player 2 Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center font-mono font-bold text-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Match Banter / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Great rally at deuce!"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "submit"}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition shadow-lg shadow-emerald-600/30"
                >
                  {actionLoading === "submit" ? "Sending Request..." : "Send for Confirmation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Player Stats Pop-up Modal */}
      {selectedPlayerId && (
        <PlayerStatsModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
          onPlayerUpdated={fetchData}
        />
      )}

      {/* Head-to-Head Compare Modal */}
      {showCompareModal && (
        <CompareModal
          players={players}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Edit Match Modal */}
      {selectedEditMatchId && (
        <EditMatchModal
          matchId={selectedEditMatchId}
          players={players}
          onClose={() => setSelectedEditMatchId(null)}
          onMatchUpdated={() => {
            fetchData();
            if (showAllRecentMatches) {
              fetchAllMatches();
            }
          }}
        />
      )}
    </div>
  );
}
