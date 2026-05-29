import { NotifyForms } from "./notify-form";

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold text-zinc-900">Notifications</div>
        <div className="text-sm text-zinc-600">Send in-app notifications to users.</div>
      </div>
      <NotifyForms />
    </div>
  );
}
