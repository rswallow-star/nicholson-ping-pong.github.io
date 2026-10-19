"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Zap,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import { formatPlayerName } from "@/lib/formatName";

interface PlayerOption {
  id: string;
  displayName: string;
  nickname?: string | null;
  roomNumber?: string | null;
}

interface EditMatchModalProps {
  matchId: string;
  onClose: () => void;
  onMatchUpdated?: () => void;
  players?: PlayerOption[];
}

export const EditMatchModal: React.FC<EditMatchModalProps> = ({
  matchId,
  onClose,
  onMatchUpdated,
  players = [],
}) => {
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form Fields
  const [matchData, setMatchData] = useState<any>(null);
  const [gameType, setGameType] = useState<11 | 21>(21);
  const [submitterId, setSubmitterId] = useState("");
  const [opponentId, setOpponentId] = useState("");
  const [submitterScore, setSubmitterScore] = useState("21");
  const [opponentScore, setOpponentScore] = useState("18");
  const [notes, setNotes] = useState("");
  const [allPlayers, setAllPlayers] = useState<PlayerOption[]>(players);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        setLoading(true);
        setError("");

        // If players list is empty, fetch leaderboard to get players
        if (allPlayers.length === 0) {
          try {
            const lbRes = await fetch("/api/leaderboard");
            if (lbRes.ok) {
              const lbData = await lbRes.json();
              if (Array.isArray(lbData.players)) {
                setAllPlayers(lbData.players);
              }
            }
          } catch {
            // Non-critical, continue
          }
        }

        const res = await fetch(`/api/matches/${matchId}`);
        if (!res.ok) {
          throw new Error("Failed to load match details.");
        }
        const json = await res.json();
        const m = json.match;
        setMatchData(m);

        setSubmitterId(m.submitterId);
        setOpponentId(m.opponentId);
        setSubmitterScore(String(m.submitterScore));
        setOpponentScore(String(m.opponentScore));

        // Determine gameType from notes tag or scores
        const is11 =
          (m.notes && m.notes.includes("[Game to 11]")) ||
          Math.max(m.submitterScore, m.opponentScore) <= 14;
        setGameType(is11 ? 11 : 21);

        // Clean any tags from notes for raw text input
        const cleanNotes = (m.notes || "")
          .replace(/\[Game to 11\]\s*/g, "")
          .replace(/\[Game to 21\]\s*/g, "")
          .trim();
        setNotes(cleanNotes);
      } catch (err: any) {
        setError(err.message || "Error loading game details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchId]);

  const handleSwapPlayers = () => {
    const tempId = submitterId;
    const tempScore = submitterScore;
    setSubmitterId(opponentId);
    setOpponentId(tempId);
    setSubmitterScore(opponentScore);
    setOpponentScore(tempScore);
  };

  const handleFormatChange = (type: 11 | 21) => {
    setGameType(type);
    const sScore = parseInt(submitterScore, 10) || 0;
    const oScore = parseInt(opponentScore, 10) || 0;

    if (type === 11 && Math.max(sScore, oScore) > 15) {
      setSubmitterScore("11");
      setOpponentScore("8");
    } else if (type === 21 && Math.max(sScore, oScore) <= 14) {
      setSubmitterScore("21");
      setOpponentScore("18");
    }
  };

  const handleAdjustScore = (isSubmitter: boolean, delta: number) => {
    if (isSubmitter) {
      const current = parseInt(submitterScore, 10) || 0;
      setSubmitterScore(String(Math.max(0, current + delta)));
    } else {
      const current = parseInt(opponentScore, 10) || 0;
      setOpponentScore(String(Math.max(0, current + delta)));
    }
  };

  const sScoreNum = parseInt(submitterScore, 10) || 0;
  const oScoreNum = parseInt(opponentScore, 10) || 0;
  const maxScore = Math.max(sScoreNum, oScoreNum);
  const minScore = Math.min(sScoreNum, oScoreNum);
  const scoreDiff = maxScore - minScore;

  // Real-time validation checks
  let scoreWarning = "";
  if (sScoreNum === oScoreNum && sScoreNum > 0) {
    scoreWarning = "Table tennis games cannot end in a draw.";
  } else if (maxScore < gameType) {
    scoreWarning = `Winning score must reach at least ${gameType} points.`;
  } else if (scoreDiff < 2) {
    scoreWarning = "Winner must win by a margin of at least 2 points.";
  } else if (maxScore > gameType && scoreDiff > 2) {
    scoreWarning = `Overtime past ${gameType} points must finish on a 2-point margin (e.g. ${maxScore}-${maxScore - 2}).`;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scoreWarning) {
      setError(scoreWarning);
      return;
    }

    if (!submitterId || !opponentId) {
      setError("Both players must be selected.");
      return;
    }

    if (submitterId === opponentId) {
      setError("Submitter and Opponent must be different players.");
      return;
    }

    setSaveLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterId,
          opponentId,
          submitterScore: sScoreNum,
          opponentScore: oScoreNum,
          gameType,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update game.");
      }

      if (onMatchUpdated) {
        onMatchUpdated();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save edits.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete game.");
      }

      if (onMatchUpdated) {
        onMatchUpdated();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete game.");
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const subPlayer = allPlayers.find((p) => p.id === submitterId);
  const submitterName =
    subPlayer
      ? formatPlayerName(subPlayer.displayName, subPlayer.nickname)
      : matchData?.submitter
      ? formatPlayerName(matchData.submitter.displayName, (matchData.submitter as any).nickname)
      : "Player 1";

  const oppPlayer = allPlayers.find((p) => p.id === opponentId);
  const opponentName =
    oppPlayer
      ? formatPlayerName(oppPlayer.displayName, oppPlayer.nickname)
      : matchData?.opponent
      ? formatPlayerName(matchData.opponent.displayName, (matchData.opponent as any).nickname)
      : "Player 2";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Edit Game Details
                {matchData && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      matchData.status === "CONFIRMED"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : matchData.status === "PENDING"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {matchData.status}
                  </span>
                )}
              </h2>
              {matchData && (
                <div className="text-[11px] text-slate-400 font-mono">
                  Played {new Date(matchData.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Loading match details...
            </div>
          ) : (
            <>
              {/* Notice regarding confirmed games */}
              {matchData?.status === "CONFIRMED" && (
                <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-3 text-xs text-purple-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-purple-200">Confirmed Game:</strong> Editing scores, players, or format will automatically recalculate the entire league's ELO standings, streaks, and match histories.
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                {/* Game Format Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Match Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormatChange(21)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                        gameType === 21
                          ? "bg-purple-600/20 border-purple-500 text-purple-200 shadow-sm"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-purple-400" /> Game to 21 (Full)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormatChange(11)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                        gameType === 11
                          ? "bg-sky-600/20 border-sky-500 text-sky-200 shadow-sm"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Zap className="w-4 h-4 text-sky-400" /> Game to 11 (Quick)
                    </button>
                  </div>
                </div>

                {/* Player Selection & Swap */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Players</span>
                    <button
                      type="button"
                      onClick={handleSwapPlayers}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition"
                      title="Swap Player 1 and Player 2"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Swap Sides
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Player 1 (Submitter)
                      </label>
                      <select
                        value={submitterId}
                        onChange={(e) => setSubmitterId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                      >
                        {allPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatPlayerName(p.displayName, p.nickname)} {p.roomNumber ? `(Rm ${p.roomNumber})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Player 2 (Opponent)
                      </label>
                      <select
                        value={opponentId}
                        onChange={(e) => setOpponentId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                      >
                        {allPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatPlayerName(p.displayName, p.nickname)} {p.roomNumber ? `(Rm ${p.roomNumber})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Scores Input */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-300 mb-3 text-center">
                    Final Score
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-center">
                    {/* Player 1 Score */}
                    <div className="text-center space-y-1.5">
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {submitterName}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustScore(true, -1)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-sm transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={submitterScore}
                          onChange={(e) => setSubmitterScore(e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono text-2xl font-black text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjustScore(true, 1)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-sm transition"
                        >
                          +
                        </button>
                      </div>
                      {sScoreNum > oScoreNum && sScoreNum >= gameType && scoreDiff >= 2 && (
                        <div className="text-[10px] font-bold text-emerald-400 font-mono">
                          🏆 Winner (+{scoreDiff})
                        </div>
                      )}
                    </div>

                    {/* Player 2 Score */}
                    <div className="text-center space-y-1.5">
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {opponentName}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustScore(false, -1)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-sm transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={opponentScore}
                          onChange={(e) => setOpponentScore(e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono text-2xl font-black text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjustScore(false, 1)}
                          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-sm transition"
                        >
                          +
                        </button>
                      </div>
                      {oScoreNum > sScoreNum && oScoreNum >= gameType && scoreDiff >= 2 && (
                        <div className="text-[10px] font-bold text-emerald-400 font-mono">
                          🏆 Winner (+{scoreDiff})
                        </div>
                      )}
                    </div>
                  </div>

                  {scoreWarning && (
                    <div className="mt-3 text-center text-xs text-amber-400 font-medium">
                      ⚠️ {scoreWarning}
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Game Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Overtime thriller, dorm tournament round 1"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    maxLength={200}
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Game
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saveLoading || Boolean(scoreWarning)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        saveLoading || Boolean(scoreWarning)
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {saveLoading ? "Saving & Recalculating..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-rose-900/50 rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
                    <div className="flex items-center gap-2.5 text-rose-400">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <h4 className="text-sm font-bold text-white">Delete this Game?</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Are you sure you want to permanently delete this game between{" "}
                      <strong className="text-white">{submitterName}</strong> and{" "}
                      <strong className="text-white">{opponentName}</strong>? All player standings and ratings will be automatically updated.
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition"
                      >
                        {deleteLoading ? "Deleting..." : "Yes, Delete Game"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
