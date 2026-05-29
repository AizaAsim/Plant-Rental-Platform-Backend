"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/page-header";
import { proxyWrite } from "@/lib/proxy-client";

type Skill = { id: string; name: string };

export function SkillsManager({ initialSkills }: { initialSkills: Skill[] }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [busy, start] = React.useTransition();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const deleteTarget = initialSkills.find((s) => s.id === deleteId);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialSkills;
    return initialSkills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [initialSkills, search]);

  function refresh() {
    router.refresh();
  }

  function addSkill() {
    const name = newName.trim();
    if (!name) {
      toast.push({ title: "Name required", variant: "error" });
      return;
    }
    start(async () => {
      try {
        await proxyWrite("POST", "/api/v1/admin/skills", { name });
        setNewName("");
        toast.push({ title: "Skill created", variant: "success" });
        refresh();
      } catch (e: unknown) {
        toast.push({
          title: "Failed",
          message: e instanceof Error ? e.message : "Error",
          variant: "error",
        });
      }
    });
  }

  function deleteSkill() {
    if (!deleteId) return;
    start(async () => {
      try {
        await proxyWrite("DELETE", `/api/v1/admin/skills/${deleteId}`);
        toast.push({ title: "Skill deleted", variant: "success" });
        setDeleteId(null);
        refresh();
      } catch (e: unknown) {
        toast.push({
          title: "Failed",
          message: e instanceof Error ? e.message : "Error",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gardener skills"
        description="Manage skills gardeners can be assigned."
        meta={`${filtered.length} shown · ${initialSkills.length} total`}
      />

      <div
        className="flex flex-col gap-3 rounded-lg border p-4 kiyaari-card sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="kiyaari-text-muted text-xs font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or ID…"
          />
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="kiyaari-text-muted text-xs font-medium">New skill name</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Soil testing"
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
          />
        </div>
        <Button type="button" disabled={busy} onClick={addSkill}>
          + Add skill
        </Button>
        {search && (
          <Button type="button" variant="secondary" onClick={() => setSearch("")}>
            Clear search
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Name</Th>
                <Th>ID</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="font-mono text-xs kiyaari-text-muted">{s.id}</Td>
                  <Td className="text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => setDeleteId(s.id)}
                    >
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={3} className="py-10 text-center kiyaari-text-muted">
                    No skills match your search.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete skill"
        description={deleteTarget ? `"${deleteTarget.name}" — cannot delete if assigned to gardeners.` : ""}
        confirmText="Delete"
        variant="danger"
        busy={busy}
        onConfirm={deleteSkill}
      />
    </div>
  );
}
