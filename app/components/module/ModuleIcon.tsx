import * as React from "react";

const GLYPHS: Record<string, React.ReactNode> = {
  "1.winddown": (<><path d="M4 7c5 0 6 8 16 8"/><line x1="4" y1="19" x2="20" y2="19"/><circle cx="20" cy="15" r="0.9" fill="currentColor" stroke="none"/></>),
  "1.worklife": (<><rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M9 9V7.5A1.5 1.5 0 0 1 10.5 6h3A1.5 1.5 0 0 1 15 7.5V9"/><line x1="4" y1="13" x2="20" y2="13"/><path d="M18.5 3.5v2.6M17.2 4.8h2.6"/></>),
  "1.day": (<><line x1="3" y1="17" x2="21" y2="17"/><path d="M7 17a5 5 0 0 1 10 0"/><line x1="12" y1="4" x2="12" y2="6"/><line x1="5.6" y1="8.6" x2="7" y2="10"/><line x1="18.4" y1="8.6" x2="17" y2="10"/></>),
  "1.money": (<><path d="M21 3 3 10.5l7.5 2.9L13.4 21 21 3z"/><path d="M21 3l-10.5 10.4"/></>),
  "1.roles": (<><circle cx="9" cy="9.5" r="3.2"/><circle cx="15" cy="9.5" r="3.2"/><circle cx="12" cy="15" r="3.2"/></>),
  "1.week": (<><line x1="4" y1="13" x2="4" y2="17"/><line x1="6.67" y1="9.5" x2="6.67" y2="17"/><line x1="9.33" y1="12" x2="9.33" y2="17"/><line x1="12" y1="7.5" x2="12" y2="17"/><line x1="14.67" y1="11" x2="14.67" y2="17"/><line x1="17.33" y1="9" x2="17.33" y2="17"/><line x1="20" y1="13.5" x2="20" y2="17"/></>),
  "1.letter": (<><rect x="4" y="6.5" width="16" height="11" rx="1.5"/><path d="M4.5 8L12 13l7.5-5"/></>),

  "2.1": (<><circle cx="13.5" cy="5" r="2"/><path d="M13 7l-1.2 5.8"/><path d="M11.8 12.8l2.7 5.2M11.8 12.8L8.7 17.3"/><path d="M12.6 8.4l2.9 1.8M12.6 8.4L9.4 9.8"/></>),
  "2.2": (<><path d="M12 3.5a5 5 0 0 1 3 9c-.6.5-.9 1-.9 1.8H9.9c0-.8-.3-1.3-.9-1.8a5 5 0 0 1 3-9z"/><line x1="10.3" y1="17" x2="13.7" y2="17"/><line x1="10.9" y1="19" x2="13.1" y2="19"/><path d="M11 11.2l1 1.3 1-1.3"/></>),
  "2.3": (<><circle cx="6" cy="8.5" r="2.2"/><circle cx="18" cy="8.5" r="2.2"/><circle cx="12" cy="16" r="2.2"/><path d="M8.1 9.4 15.9 9.4M7.2 10.3l3 4.2M16.8 10.3l-3 4.2"/></>),
  "2.4": (<><path d="M12 20v-7"/><path d="M12 13c-4 0-5.5-3-5.5-5.5 3 0 5.5 2 5.5 5.5"/><path d="M12 14.5c4 0 5.5-3 5.5-5.5-3 0-5.5 2-5.5 5.5"/></>),
  "2.5": (<><path d="M18 13.5A6.5 6.5 0 1 1 10.5 6a5 5 0 0 0 7.5 7.5z"/></>),
  "2.6": (<><path d="M2.5 10.5c3-4 8.5-4 11 0-2.5 4-8 4-11 0z"/><circle cx="8" cy="10.5" r="1.6"/><path d="M17.5 7q2 3.5 0 7M20 5.5q3 5 0 10"/></>),

  "3.1": (<><path d="M6 9.5h12l-6 10z"/><path d="M6 9.5 9 6h6l3 3.5"/><path d="M9 6 6 9.5m9-3.5 3 3.5M9 9.5l3 10 3-10"/></>),
  "3.2": (<><circle cx="12" cy="12" r="8"/><path d="M12 7l2.6 5-2.6 5-2.6-5z"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/></>),
  "3.3": (<><line x1="4" y1="18.5" x2="20" y2="18.5"/><line x1="6.5" y1="18.5" x2="6.5" y2="8"/><line x1="12" y1="18.5" x2="12" y2="11"/><line x1="17.5" y1="18.5" x2="17.5" y2="14"/></>),
  "3.4": (<><path d="M12 4l7 2.5V12c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6.5z"/><circle cx="12" cy="11.3" r="1.5"/></>),
  "3.5": (<><path d="M3 13q4.5-8 9 0t9 0"/><circle cx="7.5" cy="8.6" r="0.6" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16.6" r="0.6" fill="currentColor" stroke="none"/></>),
  "3.6": (<><circle cx="12" cy="7" r="2.4"/><path d="M3 16q9-6 18 0"/><path d="M5.5 19.5q6.5-4 13 0"/></>),

  "4.1": (<><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="9" y1="3.5" x2="9" y2="6.5"/><line x1="15" y1="3.5" x2="15" y2="6.5"/><circle cx="12" cy="14.5" r="2"/></>),
  "4.2": (<><path d="M12 6c-2-1-6-1.5-8-.5V18c2-1 6-.5 8 .5"/><path d="M12 6c2-1 6-1.5 8-.5V18c-2-1-6-.5-8 .5"/><line x1="12" y1="6" x2="12" y2="18.5"/></>),
  "4.3": (<><path d="M3.5 19l5-9 3.5 5 2-3 6.5 7z"/><path d="M12 10V4.5h3.5l-1 1.5 1 1.5H12"/></>),
  "4.4": (<><path d="M5 19C8 19 8 13.5 11.5 13.5S16.5 11.5 17 9"/><circle cx="5" cy="19" r="0.9" fill="currentColor" stroke="none"/><path d="M17 9V4.5h3.2l-1 1.4 1 1.4H17"/></>),
  "4.5": (<><line x1="12" y1="4.5" x2="12" y2="19"/><line x1="6" y1="8" x2="18" y2="8"/><path d="M6 8l-2 4h4z"/><path d="M18 8l-2 4h4z"/><line x1="9" y1="19" x2="15" y2="19"/></>),
  "4.6": (<><path d="M9.2 4h5.6L18 19H6z"/><line x1="6.6" y1="15" x2="17.4" y2="15"/><line x1="12" y1="17" x2="13.9" y2="6.5"/><rect x="12.3" y="8.6" width="2.1" height="2.1" rx="0.3"/><path d="M10.8 5.3q3-1 5 .2"/></>),
  "4.7": (<><rect x="5" y="5" width="14" height="15" rx="2"/><line x1="9" y1="3.4" x2="9" y2="6.2"/><line x1="15" y1="3.4" x2="15" y2="6.2"/><path d="M10.8 11.4l2.2-1.3v7.2"/><line x1="10.9" y1="17.3" x2="14.9" y2="17.3"/></>),

  "5.1": (<><circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></>),
};

const FALLBACK = (<circle cx="12" cy="12" r="7"/>);

export function ModuleIcon({
  id,
  size = 24,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const glyph = GLYPHS[id];
  if (!glyph && process.env.NODE_ENV !== "production") {
    console.warn(`[ModuleIcon] no glyph for module id "${id}" — using fallback`);
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {glyph ?? FALLBACK}
    </svg>
  );
}
