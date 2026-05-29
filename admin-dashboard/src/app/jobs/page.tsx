import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobsRunner } from "./runner";

export default function JobsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Internal jobs"
        description="Run maintenance jobs against the API. Always start with dry_run: true."
      />
      <Card>
        <CardHeader>
          <CardTitle>Run admin jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <JobsRunner />
        </CardContent>
      </Card>
    </div>
  );
}
