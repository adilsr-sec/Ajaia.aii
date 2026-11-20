"use client";

interface UserAvatarProps {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({ name, color, size = "md" }: UserAvatarProps) {
  const sizeClass =
    size === "sm"
      ? "h-6 w-6 text-[11px]"
      : size === "lg"
        ? "h-10 w-10 text-sm"
        : "h-8 w-8 text-xs";

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none`}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </span>
  );
}
