"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Chapter {
  id: string;
  title: string;
  questionCount: number;
}

function Row({ quizId, chapter }: { quizId: string; chapter: Chapter }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

  return (
    <li
      ref={setNodeRef}
      className="qz-question-card"
      style={{
        padding: "1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Réordonner ce chapitre"
        style={{
          cursor: "grab",
          background: "none",
          border: "none",
          fontSize: "1.25rem",
          lineHeight: 1,
          color: "var(--qz-muted)",
          padding: "0.25rem",
          touchAction: "none",
        }}
      >
        ⠿
      </button>
      <Link
        href={`/quizzes/${quizId}/edit/${chapter.id}`}
        style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ fontWeight: 600 }}>{chapter.title}</span>
        <span className="qz-chapter-questions-count">{chapter.questionCount} questions</span>
      </Link>
    </li>
  );
}

export default function ChapterReorderList({ quizId, initialChapters }: { quizId: string; initialChapters: Chapter[] }) {
  const [chapters, setChapters] = useState(initialChapters);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    const previous = chapters;
    const next = arrayMove(chapters, oldIndex, newIndex);
    setChapters(next);
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/quizzes/${quizId}/chapters/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeIds: next.map((c) => c.id) }),
    });
    if (!res.ok) {
      setChapters(previous);
      setError("Échec de l'enregistrement de l'ordre.");
    }
    setSaving(false);
  }

  async function handleAddChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    setError(null);

    const res = await fetch(`/api/quizzes/${quizId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (!res.ok) {
      setError("Échec de l'ajout du chapitre.");
      setAdding(false);
      return;
    }
    const { theme } = await res.json();
    setChapters((prev) => [...prev, { id: theme.id, title: theme.title, questionCount: 0 }]);
    setNewTitle("");
    setAdding(false);
  }

  return (
    <div>
      <DndContext id="chapter-reorder" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {chapters.map((chapter) => (
              <Row key={chapter.id} quizId={quizId} chapter={chapter} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {saving && <p style={{ fontSize: "0.8rem", color: "var(--qz-muted)" }}>Enregistrement…</p>}
      {error && <p style={{ fontSize: "0.8rem", color: "var(--qz-error)" }}>{error}</p>}

      <form onSubmit={handleAddChapter} style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Titre du nouveau chapitre"
          className="qz-form-group"
          style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid var(--qz-border)", borderRadius: "8px" }}
        />
        <button type="submit" className="qz-btn-quit" disabled={adding || !newTitle.trim()}>
          {adding ? "Ajout…" : "+ Ajouter un chapitre"}
        </button>
      </form>
    </div>
  );
}
