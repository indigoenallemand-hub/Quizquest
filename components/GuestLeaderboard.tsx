import type { GuestLeaderboardEntry } from "@/lib/guest-leaderboard";

export default function GuestLeaderboard({ entries }: { entries: GuestLeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="qz-leaderboard">
      <h2 className="qz-leaderboard-title">🏆 Top invites</h2>
      <ol className="qz-leaderboard-list">
        {entries.map((entry, i) => (
          <li key={entry.guestAccessId} className="qz-leaderboard-row">
            <span className="qz-leaderboard-rank">{i + 1}</span>
            <span className="qz-leaderboard-name">{entry.guestName ?? "Invite sans nom"}</span>
            <span className="qz-leaderboard-points">{entry.points} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
