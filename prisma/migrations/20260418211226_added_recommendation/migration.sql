-- DropForeignKey
ALTER TABLE "maintenance_tasks" DROP CONSTRAINT "maintenance_tasks_gardener_id_fkey";

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
