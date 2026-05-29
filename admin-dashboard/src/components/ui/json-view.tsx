import * as React from "react";

export function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="kiyaari-json whitespace-pre-wrap break-words rounded-md px-3 py-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
