type IconName = "fuel" | "wrench" | "chart" | "calendar" | "folder" | "bell" | "bolt" | "gauge";

const PATHS: Record<IconName, string> = {
  fuel: "M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 22h10M3 10h10M16 6.5l2.5 2.5V17a1.5 1.5 0 0 0 3 0v-5.5a2 2 0 0 0-.6-1.4L18 7",
  wrench: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z",
  chart: "M4 20V10M11 20V4M18 20v-7",
  calendar: "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  folder: "M4 6a1 1 0 0 1 1-1h4.5l2 2H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 0 1-3.46 0",
  gauge: "M4.5 17a8.5 8.5 0 1 1 15 0M12 16l3.5-5M12 7.5v1.5M6.8 10.5l1 1M17.2 10.5l-1 1",
  bolt: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
};

export default function ActionGridIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
