"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export function NotifyForms() {
  const toast = useToast();
  const [busy, start] = React.useTransition();

  const [userId, setUserId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [bulkTitle, setBulkTitle] = React.useState("");
  const [bulkMessage, setBulkMessage] = React.useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Send to one user</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="User UUID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await fetch("/api/proxy", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-proxy-path": "/api/v1/notifications/send",
                  },
                  body: JSON.stringify({
                    user_id: userId,
                    title,
                    message,
                    type: "SYSTEM",
                    channels: ["IN_APP"],
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  toast.push({ title: "Failed", message: data?.message, variant: "error" });
                  return;
                }
                toast.push({ title: "Sent", variant: "success" });
              })
            }
          >
            Send
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk send (active users)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title" value={bulkTitle} onChange={(e) => setBulkTitle(e.target.value)} />
          <Textarea
            placeholder="Message"
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
          />
          <Button
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await fetch("/api/proxy", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-proxy-path": "/api/v1/notifications/bulk-send",
                  },
                  body: JSON.stringify({
                    filter: { role: "USER", is_active: true },
                    title: bulkTitle,
                    message: bulkMessage,
                    type: "PROMOTION",
                    channels: ["IN_APP"],
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  toast.push({ title: "Failed", message: data?.message, variant: "error" });
                  return;
                }
                toast.push({
                  title: "Bulk sent",
                  message: `Sent: ${data?.sent ?? "?"}`,
                  variant: "success",
                });
              })
            }
          >
            Bulk send
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
