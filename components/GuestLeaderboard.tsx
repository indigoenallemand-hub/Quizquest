import type { GuestLeaderboardEntry } from "@/lib/guest-leaderboard";
import DuelChallengeButton from "@/components/DuelChallengeButton";

// `challenge` is passed on a guest's own share-link menu: every other guest
// of the list then gets a "Défier" button.
export default function GuestLeaderboard({
  entries,
  challenge,
}: {
  entries: GuestLeaderboardEntry[];
  challenge?: { token: string; currentGuestId: string };
}) {
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
            {challenge && entry.guestAccessId !== challenge.currentGuestId && (
              <DuelChallengeButton token={challenge.token} opponentId={entry.guestAccessId} opponentName={entry.guestName ?? "Invite sans nom"} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
