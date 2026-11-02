import { Badge } from "@/components/ui/badge";
import { STAGE_COLORS } from "./format";
import type { Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const c = STAGE_COLORS[stage];
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", c.badge, className)}>
      <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", c.dot)} />
      {c.label}
    </Badge>
  );
}
