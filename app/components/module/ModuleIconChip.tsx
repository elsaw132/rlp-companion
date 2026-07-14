import * as React from "react";
import { ModuleIcon } from "./ModuleIcon";

type StageKey = "imagine" | "explore" | "understand" | "plan" | "act";

const SIZES = {
  md: { chip: 48, icon: 36, radius: 14 },
  lg: { chip: 64, icon: 48, radius: 18 },
} as const;

export function ModuleIconChip({
  moduleId,
  stageKey,
  size = "md",
  className,
}: {
  moduleId: string;
  stageKey: StageKey;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      data-stage={stageKey}
      className={className}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: s.chip,
        height: s.chip,
        borderRadius: s.radius,
        flexShrink: 0,
        background: `var(--color-stage-${stageKey})`,
        color: `var(--color-on-stage-${stageKey})`,
      }}
    >
      <ModuleIcon id={moduleId} size={s.icon} />
    </span>
  );
}
