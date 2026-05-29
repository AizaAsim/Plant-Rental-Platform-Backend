export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { title: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    title: "Main",
    items: [{ href: "/admin", label: "Overview", icon: "📊" }],
  },
  {
    title: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: "👥" },
      { href: "/admin/nurseries", label: "Nurseries", icon: "🏪" },
      { href: "/admin/gardeners", label: "Gardeners", icon: "🧑‍🌾" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "📦" },
      { href: "/admin/bookings", label: "Bookings", icon: "📅" },
      { href: "/admin/payouts", label: "Payouts", icon: "💰" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/admin/disputes", label: "Disputes", icon: "⚖️" },
      { href: "/admin/order-complaints", label: "Complaints", icon: "📣" },
      { href: "/admin/manual-orders", label: "Manual queue", icon: "🛠️" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/featured-plants", label: "Featured plants", icon: "⭐" },
      { href: "/admin/coupons", label: "Coupons", icon: "🎟️" },
      { href: "/admin/categories", label: "Categories", icon: "🌳" },
      { href: "/admin/skills", label: "Skills", icon: "✂️" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "📈" },
      { href: "/admin/settings", label: "Settings", icon: "⚙️" },
      { href: "/admin/notifications", label: "Notifications", icon: "🔔" },
      { href: "/jobs", label: "Internal jobs", icon: "🔧" },
    ],
  },
];

const titles: Record<string, string> = {};
for (const g of navGroups) {
  for (const item of g.items) {
    titles[item.href] = item.label;
  }
}
titles["/admin/orders"] = "Orders";
titles["/admin/disputes"] = "Disputes";

export function pageTitleFromPath(pathname: string): string {
  if (titles[pathname]) return titles[pathname];
  for (const [href, label] of Object.entries(titles)) {
    if (pathname.startsWith(`${href}/`)) return label;
  }
  const slug = pathname.split("/").filter(Boolean).pop() ?? "Admin";
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
