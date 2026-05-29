"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JsonView } from "@/components/ui/json-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export type ResourceEndpoint = {
  key: string;
  label: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  defaultQuery?: Record<string, string>;
  defaultBody?: Record<string, unknown>;
  help?: string;
  dangerous?: boolean;
};

export function ResourcePage({
  title,
  description,
  endpoints,
}: {
  title: string;
  description?: string;
  endpoints: ResourceEndpoint[];
}) {
  const toast = useToast();
  const [selectedKey, setSelectedKey] = React.useState(endpoints[0]?.key ?? "");
  const selected = endpoints.find((e) => e.key === selectedKey) ?? endpoints[0];

  const [queryText, setQueryText] = React.useState(() =>
    JSON.stringify(selected?.defaultQuery ?? {}, null, 2)
  );
  const [bodyText, setBodyText] = React.useState(() =>
    JSON.stringify(selected?.defaultBody ?? {}, null, 2)
  );
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (!selected) return;
    setQueryText(JSON.stringify(selected.defaultQuery ?? {}, null, 2));
    setBodyText(JSON.stringify(selected.defaultBody ?? {}, null, 2));
    setResult(null);
    setError(null);
  }, [selectedKey]);

  const run = () =>
    start(async () => {
      if (!selected) return;
      setError(null);
      setResult(null);

      let query: Record<string, string> = {};
      let body: any = {};
      try {
        query = queryText.trim() ? JSON.parse(queryText) : {};
      } catch (e: any) {
        setError(`Invalid query JSON: ${e?.message || "parse error"}`);
        return;
      }
      try {
        body = bodyText.trim() ? JSON.parse(bodyText) : {};
      } catch (e: any) {
        setError(`Invalid body JSON: ${e?.message || "parse error"}`);
        return;
      }

      const qs = new URLSearchParams(query).toString();
      const path = `${selected.path}${qs ? `?${qs}` : ""}`;

      const res =
        selected.method === "GET"
          ? await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, { method: "GET" })
          : await fetch(`/api/proxy`, {
              method: selected.method,
              headers: { "Content-Type": "application/json", "x-proxy-path": path },
              body: JSON.stringify(body),
            });

      const data = await res.json().catch(() => ({}));
      setResult(data);
      if (!res.ok) {
        setError(data?.message || "Request failed");
        toast.push({ title: "Request failed", message: data?.message || "Error", variant: "error" });
      } else {
        toast.push({ title: "Request succeeded", variant: "success" });
      }
    });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold text-zinc-900">{title}</div>
        {description && <div className="text-sm text-zinc-600">{description}</div>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Select</div>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
              >
                {endpoints.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>
              {selected?.help && <div className="text-xs text-zinc-500">{selected.help}</div>}
              <div className="text-xs text-zinc-500">
                {selected?.method} {selected?.path}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Quick IDs</div>
              <div className="text-xs text-zinc-500">
                Replace `:id` segments directly in the path inside the endpoint definition (this UI
                is generic). If you want, we can add ID input fields per page later.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Query (JSON)</div>
              <Textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="min-h-28 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Body (JSON)</div>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="min-h-28 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={selected?.dangerous ? "danger" : "primary"}
              disabled={pending}
              onClick={run}
            >
              {pending ? "Running…" : "Run"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setError(null);
                setResult(null);
              }}
            >
              Clear
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {result != null && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Response</div>
              <JsonView value={result} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

