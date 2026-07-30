import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  collapsed?: boolean;
}

const ThemeToggle = ({ className, collapsed }: Props) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size={collapsed ? "icon" : "sm"}
      onClick={(e) => toggleTheme(e.clientX, e.clientY)}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "rounded-lg font-semibold transition-colors",
        collapsed ? "w-9 h-9" : "w-full justify-start",
        className,
      )}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {!collapsed && <span className="ml-2">{isDark ? "Modo claro" : "Modo oscuro"}</span>}
    </Button>
  );
};

export default ThemeToggle;