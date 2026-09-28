import { useNavigate } from 'react-router-dom';
import { FileQuestion, Search } from 'lucide-react';
import { Button } from '../components/ui.jsx';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-600/10 text-navy-600 dark:bg-navy-950/60 dark:text-navy-300">
        <FileQuestion className="h-8 w-8" />
      </div>
      <p className="text-6xl font-black tracking-tight text-navy-600/20 dark:text-navy-300/20">
        404
      </p>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        The page you are looking for does not exist, was moved, or you do not have permission to
        view it.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
        <Button variant="secondary" onClick={() => navigate('/search')}>
          <Search className="h-4 w-4" /> Search instead
        </Button>
      </div>
    </div>
  );
}
