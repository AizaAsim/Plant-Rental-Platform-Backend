import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { fetchAdmin } from "@/lib/admin-page";
import { CommissionForm } from "./commission-form";
import { SettingRow } from "./setting-row";
import { AddSettingForm } from "./add-setting-form";
import { FreelanceMatchForm } from "./freelance-form";

type Setting = { key: string; value: string; description?: string | null };

type Commission = {
  vendor_commission_rate: number;
  gardener_commission_rate: number;
};

type FreelanceResp = {
  success: boolean;
  data: {
    auto_match_enabled: boolean;
    auto_match_score_threshold: number;
    gardener_accept_window_minutes: number;
  };
};

const COMMISSION_KEYS = new Set(["commission.vendor_rate", "commission.gardener_rate"]);

export default async function AdminSettingsPage() {
  const [commission, settings, freelance] = await Promise.all([
    fetchAdmin<Commission>("/api/v1/admin/settings/commission", "/admin/settings"),
    fetchAdmin<Setting[]>("/api/v1/admin/settings", "/admin/settings"),
    fetchAdmin<FreelanceResp>("/api/v1/admin/settings/freelance-match-config", "/admin/settings").catch(
      () => null
    ),
  ]);

  const otherSettings = settings.filter((s) => !COMMISSION_KEYS.has(s.key));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-zinc-900">Settings</div>
        <div className="text-sm text-zinc-600">Edit platform configuration (saved via admin API).</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission rates</CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionForm
            vendorPercent={commission.vendor_commission_rate * 100}
            gardenerPercent={commission.gardener_commission_rate * 100}
          />
        </CardContent>
      </Card>

      {freelance?.data && (
        <Card>
          <CardHeader>
            <CardTitle>Freelance job auto-match</CardTitle>
          </CardHeader>
          <CardContent>
            <FreelanceMatchForm
              autoMatchEnabled={freelance.data.auto_match_enabled}
              scoreThreshold={freelance.data.auto_match_score_threshold}
              acceptWindowMinutes={freelance.data.gardener_accept_window_minutes}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Platform settings ({otherSettings.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <thead>
              <Tr>
                <Th>Key</Th>
                <Th>Description</Th>
                <Th className="text-right">Value</Th>
              </Tr>
            </thead>
            <tbody>
              {otherSettings.map((s) => (
                <Tr key={s.key}>
                  <Td className="font-mono text-xs align-top">{s.key}</Td>
                  <Td className="max-w-xs text-xs text-zinc-500 align-top">{s.description ?? "—"}</Td>
                  <Td className="align-top">
                    <SettingRow settingKey={s.key} initialValue={s.value} description={s.description} />
                  </Td>
                </Tr>
              ))}
              {otherSettings.length === 0 && (
                <Tr>
                  <Td colSpan={3} className="py-6 text-center text-sm text-zinc-500">
                    No other settings yet. Add one below.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
          <AddSettingForm />
        </CardContent>
      </Card>
    </div>
  );
}
