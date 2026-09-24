const BADGE_DEFS = [
  { type: "EXPLORATEUR" as const, icon: "/badges/explorator.png", label: "Explorateur", description: "Toutes les questions du quiz ont ete repondues correctement, au fil des tentatives." },
  { type: "QCM" as const, icon: "/badges/qcm.png", label: "QCM parfait", description: "Toutes les questions repondues correctement en une seule tentative de Test complet (QCM)." },
  { type: "REPONSE_LIBRE" as const, icon: "/badges/qr.png", label: "Reponse libre parfaite", description: "Toutes les questions repondues correctement en une seule tentative en mode Reponse libre." },
];

export default function BadgeRow({ earned, reponseLibreBadgeEnabled = true }: { earned: Set<string>; reponseLibreBadgeEnabled?: boolean }) {
  const badges = reponseLibreBadgeEnabled ? BADGE_DEFS : BADGE_DEFS.filter((b) => b.type !== "REPONSE_LIBRE");
  return (
    <div className="qz-badge-row">
      {badges.map((badge) => {
        const isEarned = earned.has(badge.type);
        return (
          <div key={badge.type} className={`qz-badge-item ${isEarned ? "is-earned" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badge.icon} alt={badge.label} />
            <div className="qz-badge-tooltip">
              <strong>{badge.label}</strong>
              <span>
                {isEarned ? "Obtenu ! " : ""}
                {badge.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
