const fieldClass = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

export function OdrSlotFields({
  duration = 30,
  dateLabel = "First hearing date",
}: {
  duration?: number;
  dateLabel?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {dateLabel}
        <input name="hearingDate" type="date" required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Start time
        <input name="hearingTime" type="time" required defaultValue="11:00" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Daily window starts
        <input name="windowStart" type="time" required defaultValue="10:00" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Daily window ends
        <input name="windowEnd" type="time" required defaultValue="18:00" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Hearing length (minutes)
        <input name="duration" type="number" min={15} max={240} defaultValue={duration} required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Gap between hearings (minutes)
        <input name="gapMinutes" type="number" min={0} max={180} defaultValue={15} required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Lunch break starts
        <input name="breakStart" type="time" required defaultValue="13:30" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Lunch break ends
        <input name="breakEnd" type="time" required defaultValue="14:30" className={fieldClass} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="skipSundays" value="on" defaultChecked className="size-4 accent-primary" />
        Skip Sundays
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Holidays to skip
        <textarea
          name="holidays"
          rows={3}
          placeholder="Optional. One date per line, such as 2026-10-02"
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm font-normal"
        />
      </label>
    </div>
  );
}
