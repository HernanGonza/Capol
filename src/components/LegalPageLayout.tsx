import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useDocumentMeta } from "@/hooks/use-document-meta";

interface LegalPageLayoutProps {
  title: string;
  actualizado: string;
  path: string;
  children: ReactNode;
}

// Layout compartido por las páginas legales (Términos, Privacidad, etc.) —
// mismo encabezado/pie que el resto del sitio público, para que se sientan
// parte de la plataforma y no un documento suelto.
const LegalPageLayout = ({ title, actualizado, path, children }: LegalPageLayoutProps) => {
  useDocumentMeta(`${title} | CapOL`, path);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0f] text-slate-900 dark:text-white">
      <header className="border-b border-slate-200 dark:border-white/10 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-capol.webp" alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-black text-lg tracking-tight">CapOL</span>
          </Link>
          <ThemeToggle
            collapsed
            className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-white/50 mb-10">Última actualización: {actualizado}</p>

        <div className="space-y-8 text-slate-700 dark:text-white/70 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:dark:text-white [&_h2]:mb-3 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-indigo-600 [&_a]:dark:text-indigo-400 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-slate-900 [&_strong]:dark:text-white">
          {children}
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-white/10 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-white/50">
          <p>© {new Date().getFullYear()} CapOL. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/terminos" className="hover:text-slate-900 dark:hover:text-white transition-colors">Términos y Condiciones</Link>
            <span className="text-slate-300 dark:text-white/20">|</span>
            <Link to="/privacidad" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LegalPageLayout;
