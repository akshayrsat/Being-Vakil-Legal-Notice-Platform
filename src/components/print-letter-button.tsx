"use client";

export function PrintLetterButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print h-11 rounded-lg border border-input bg-card px-4 text-sm font-medium"
    >
      Print letter
    </button>
  );
}
