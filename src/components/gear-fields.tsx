import { ChevronDown } from "lucide-react";
import { FIELD_GROUPS, GEAR_FIELDS, OPTION_LABEL, sanitizeGear, type GearSettings } from "@/lib/gear";
import { controlClass, Switch } from "@/components/ui";

const GROUP_HINT: Record<(typeof FIELD_GROUPS)[number], string> = {
  Gerak: "Scroll ini dipakai mode Studio pada tautan yang dimuat.",
  Gambar: "Ukuran, kecepatan, jeda, dan berkas video.",
  Lapisan: "Ditulis langsung di atas hasil rekaman.",
  Berkas: "Awalan nama saat video diunduh.",
};

export function GearFields({
  value,
  disabled,
  onChange,
}: {
  value: GearSettings;
  disabled?: boolean;
  onChange: (next: GearSettings) => void;
}) {
  const update = (key: keyof GearSettings, raw: string | boolean) => {
    onChange(sanitizeGear({ ...value, [key]: raw }, value));
  };

  return (
    <div>
      {FIELD_GROUPS.map((group) => (
        <div key={group} className="mt-3">
          <p className="text-xs font-extrabold tracking-wide text-pink-dark">{group}</p>
          <p className="mb-2 text-xs text-muted">{GROUP_HINT[group]}</p>
          {GEAR_FIELDS.filter((field) => field.group === group).map((field) => {
            if (field.kind === "bool") {
              const on = Boolean(value[field.key]);
              return (
                <div key={field.key} className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    <span className="mr-2 text-xs text-muted">{String(field.n).padStart(2, "0")}</span>
                    {field.label}
                  </span>
                  <Switch on={on} label={field.label} disabled={disabled} onClick={() => update(field.key, !on)} />
                </div>
              );
            }
            return (
              <label key={field.key} className="mb-3 block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
                  <span>
                    <span className="mr-2">{String(field.n).padStart(2, "0")}</span>
                    {field.label}
                  </span>
                  {field.kind === "range" ? (
                    <b className="font-bold text-pink-dark">
                      {String(value[field.key])}
                      {field.key === "fontScale" ? "%" : ""}
                    </b>
                  ) : null}
                </span>
                {field.kind === "range" ? (
                  <input
                    data-gear={field.key}
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={Number(value[field.key])}
                    disabled={disabled}
                    onChange={(event) => update(field.key, event.target.value)}
                    className="w-full accent-pink disabled:opacity-40"
                  />
                ) : null}
                {field.kind === "select" ? (
                  <span className="relative block">
                    <select
                      data-gear={field.key}
                      value={String(value[field.key])}
                      disabled={disabled}
                      onChange={(event) => update(field.key, event.target.value)}
                      className={`${controlClass} appearance-none pr-8`}
                    >
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {OPTION_LABEL[option] ?? option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-pink" />
                  </span>
                ) : null}
                {field.kind === "text" ? (
                  <input
                    data-gear={field.key}
                    value={String(value[field.key])}
                    disabled={disabled}
                    maxLength={32}
                    onChange={(event) => update(field.key, event.target.value)}
                    className={controlClass}
                  />
                ) : null}
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
