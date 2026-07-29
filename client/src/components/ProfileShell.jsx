import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import Profile from '../pages/Profile';

export default function ProfileShell() {
  const { user, defaultCampusId } = useAuth();
  const navigate = useNavigate();
  const campusId = user?.campusId || defaultCampusId || localStorage.getItem('campusId');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Logo size="sm" />
            {campusId ? (
              <Link
                to={`/campus/${campusId}`}
                className="text-sm text-brand-600 hover:underline flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to portal
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/campuses')}
                className="text-sm text-brand-600 hover:underline flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to campuses
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 lg:p-8">
        <Profile />
      </main>
    </div>
  );
}
