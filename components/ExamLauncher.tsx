import Link from "next/link";
import { EXAM_DURATION_MS, EXAM_QUESTION_COUNT } from "@/lib/exam";

// "LE TEST" entry point, shown under the chapter carousel.
export default function ExamLauncher({ href }: { href: string }) {
  const hours = EXAM_DURATION_MS / 3_600_000;
  return (
    <div className="qz-exam-launcher">
      <div>
        <strong className="qz-exam-launcher-title">LE TEST</strong>
        <p className="qz-exam-launcher-text">
          {EXAM_QUESTION_COUNT} questions tirées de tout le quiz (1/3 droit du bail, puis administration PPE et gérance
          technique), {hours} heures maximum, note suisse de 1 à 6. La bonne réponse s&apos;affiche après chaque question.
        </p>
      </div>
      <Link href={href} className="qz-btn-primary qz-exam-launcher-btn">
        Faire LE TEST
      </Link>
    </div>
  );
}
