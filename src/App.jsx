import React, { useState, useEffect, useCallback } from 'react';
import { Tent, Wrench, Users } from 'lucide-react';
import { api } from './api';
import CreatorPage from './components/CreatorPage';
import FamilyTripPage from './components/FamilyTripPage';

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [route, id] = raw.split('/');
  return { route: route || '', id: id || null };
}

export default function App() {
  const [{ route, id }, setLocation] = useState(parseHash);
  const [base, setBase] = useState({ families: [], trips: [], counts: [] });
  const [loading, setLoading] = useState(true);
  const [meId, setMeIdState] = useState(() => Number(localStorage.getItem('meId')) || null);
  const [switchingFamily, setSwitchingFamily] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const setMeId = (val) => {
    const num = val ? Number(val) : null;
    setMeIdState(num);
    if (num) localStorage.setItem('meId', String(num));
    else localStorage.removeItem('meId');
  };

  const loadBase = useCallback(async () => {
    const d = await api('bootstrap');
    setBase(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBase();
    const onHash = () => setLocation(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [loadBase]);

  const isAdmin = route === 'admin';
  const activeTripId = route === 'trip' && id ? id : base.trips[0]?.id;
  const myFamily = base.families.find((f) => f.id === Number(meId)) || null;
  const isJoinedActiveTrip = activeTripId && localStorage.getItem(`joinedTrip_${activeTripId}`) === '1' && !!myFamily;

  return (
    <div className="min-h-screen flex flex-col bg-cream text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-slate-800">
            {isAdmin ? (
              <>
                <Wrench className="w-5 h-5 text-coral-500" />
                <span>מערכת מארגן הטיולים</span>
              </>
            ) : (
              <>
                <Tent className="w-5 h-5 text-forest-600" />
                <span>טיולי הכיתה</span>
              </>
            )}
          </div>

          {!isAdmin && isJoinedActiveTrip && !switchingFamily && (
            <button
              type="button"
              onClick={() => setSwitchingFamily(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-forest-50 hover:bg-forest-100 text-forest-700 border border-forest-200 text-xs font-semibold transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{myFamily.name}</span>
              <span className="text-forest-500">· עריכה</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-4 py-6 flex-1">
        {loading ? (
          <div className="py-20 text-center text-slate-400">טוען... 🌿</div>
        ) : isAdmin ? (
          <CreatorPage
            tripId={id}
            trips={base.trips}
            families={base.families}
            counts={base.counts}
            onRefresh={loadBase}
            showToast={showToast}
          />
        ) : activeTripId ? (
          <FamilyTripPage
            tripId={activeTripId}
            families={base.families}
            meId={meId}
            setMeId={setMeId}
            switchingFamily={switchingFamily}
            setSwitchingFamily={setSwitchingFamily}
            onRefreshBase={loadBase}
            showToast={showToast}
          />
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500">
            עדיין לא פורסם טיול קרוב 🌿
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toast}
        </div>
      )}
    </div>
  );
}
