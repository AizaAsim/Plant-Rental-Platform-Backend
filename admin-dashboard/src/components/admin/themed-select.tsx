import { cn } from "@/components/ui/cn";

export function ThemedSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("kiyaari-select h-10 rounded-md px-3 text-sm", className)} {...props} />;
}
