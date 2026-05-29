export function ListSearch({
  placeholder = "Search…",
  defaultValue,
}: {
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <form className="flex gap-2" method="get">
      <input
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full max-w-sm rounded-md border px-3 text-sm"
        style={{
          borderColor: "var(--card-border)",
          background: "var(--card)",
          color: "var(--foreground)",
        }}
      />
      <button type="submit" className="kiyaari-btn-primary h-10 rounded-md px-4 text-sm font-medium">
        Search
      </button>
    </form>
  );
}
