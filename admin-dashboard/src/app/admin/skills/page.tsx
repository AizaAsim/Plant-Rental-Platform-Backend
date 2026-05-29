import { fetchAdmin } from "@/lib/admin-page";
import { SkillsManager } from "./skills-manager";

type Skill = { id: string; name: string };

export default async function AdminSkillsPage() {
  const items = await fetchAdmin<Skill[]>("/api/v1/admin/skills", "/admin/skills");
  return <SkillsManager initialSkills={items} />;
}
