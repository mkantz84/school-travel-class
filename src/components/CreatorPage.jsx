import React, { useState, useEffect } from 'react';
import {
  Plus, Minus, Share2, Trash2, Edit3, ExternalLink, MapPin, Compass, Calendar, ArrowRight, Check, Sparkles, Users, AlertCircle
} from 'lucide-react';
import { api, getTripImage, findDuplicateFamily } from '../api';
import DateRangePicker, { formatHebrewRange } from './DateRangePicker';
import Modal, { ConfirmDeleteModal } from './Modal';

const EMPTY_TRIP = {
  name: '',
  start_date: '',
  end_date: '',
  lodging: '',
  destination: '',
  schedule: '',
};

export default function CreatorPage({ tripId, trips, families = [], counts, onRefresh, showToast }) {
  const [activeTrip, setActiveTrip] = useState(null);
  const [form, setForm] = useState(EMPTY_TRIP);
  const [saving, setSaving] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_TRIP);
  const [familyModal, setFamilyModal] = useState(null); // { id?, name, adults, notes }
  const [confirmDelete, setConfirmDelete] = useState(null); // { title, message, onConfirm }
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (tripId) {
      api('trips/' + tripId).then((d) => {
        setActiveTrip(d.trip);
        setForm({
          name: d.trip.name || '',
          start_date: d.trip.start_date || '',
          end_date: d.trip.end_date || '',
          lodging: d.trip.lodging || '',
          destination: d.trip.destination || '',
          schedule: d.trip.schedule || '',
        });
      });
    } else {
      setActiveTrip(null);
    }
  }, [tripId]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newForm.name.trim()) {
      showToast('נא להזין שם לטיול');
      return;
    }
    setSaving(true);
    try {
      const res = await api('trips', 'POST', newForm);
      setNewModalOpen(false);
      setNewForm(EMPTY_TRIP);
      await onRefresh();
      showToast('הטיול נוצר בהצלחה!');
      window.location.hash = `#/admin/${res.id}`;
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTrip = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('נא להזין שם לטיול');
      return;
    }
    setSaving(true);
    try {
      await api('trips/' + tripId, 'PUT', form);
      await onRefresh();
      showToast('פרטי הטיול נשמרו ✨');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteTrip = (trip) => {
    setConfirmDelete({
      title: 'מחיקת טיול',
      message: `האם אתם בטוחים שברצונכם למחוק את הטיול ״${trip.name}״? כל נתוני המשתתפים, התפקידים וההוצאות של הטיול יימחקו לצמיתות.`,
      onConfirm: async () => {
        await api('trips/' + trip.id, 'DELETE');
        setConfirmDelete(null);
        showToast('הטיול נמחק');
        if (String(trip.id) === String(tripId)) {
          window.location.hash = '#/admin';
        }
        await onRefresh();
      },
    });
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    const trimmed = (familyModal?.name || '').trim();
    if (!trimmed) {
      showToast('נא להזין שם משפחה');
      return;
    }
    const dup = findDuplicateFamily(trimmed, families, familyModal.id);
    if (dup) {
      showToast('שם המשפחה כבר קיים – נא להוסיף שמות פרטיים');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        adults: Math.max(1, Number(familyModal.adults) || 1),
        kids: 0,
        notes: (familyModal.notes || '').trim(),
      };
      if (familyModal.id) {
        await api('families/' + familyModal.id, 'PUT', payload);
        showToast('פרטי המשפחה עודכנו ✨');
      } else {
        await api('families', 'POST', payload);
        showToast('המשפחה נוספה בהצלחה ✨');
      }
      setFamilyModal(null);
      await onRefresh();
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteFamily = (fam) => {
    setConfirmDelete({
      title: 'מחיקת משפחה',
      message: `האם אתם בטוחים שברצונכם למחוק את המשפחה ״${fam.name}״ מהמערכת? פעולה זו תסיר אותה גם מרשימות המשתתפים ותמחק את ההוצאות ששולמו על ידה בכל הטיולים (מה שישפיע על חישובי ההוצאות והחובות).`,
      onConfirm: async () => {
        await api('families/' + fam.id, 'DELETE');
        setConfirmDelete(null);
        setFamilyModal(null);
        showToast('המשפחה נמחקה');
        await onRefresh();
      },
    });
  };

  const executeConfirmedDelete = async () => {
    if (!confirmDelete?.onConfirm) return;
    setDeleting(true);
    try {
      await confirmDelete.onConfirm();
    } catch (err) {
      showToast(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const shareTrip = (id, name) => {
    const url = `${window.location.origin}/#/trip/${id}`;
    const text = `⛺ *${name}*\nהרשמה לטיול, פרטי מסלול וחלוקת תפקידים בלינק:\n${url}`;
    navigator.clipboard?.writeText(url).then(() => showToast('הלינק הועתק ללוח! 📋'), () => {});
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  if (tripId && activeTrip) {
    const shareUrl = `${window.location.origin}/#/trip/${activeTrip.id}`;
    const dateLabel = formatHebrewRange(form.start_date, form.end_date);
    const tripBanner = getTripImage(form);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <a
            href="#/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-forest-600 transition"
          >
            <ArrowRight className="w-4 h-4" />
            כל הטיולים
          </a>
          <div className="flex items-center gap-2">
            <a
              href={`#/trip/${activeTrip.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-forest-500 transition"
            >
              <ExternalLink className="w-4 h-4" />
              פתיחת דף המשפחות
            </a>
            <button
              type="button"
              onClick={() => shareTrip(activeTrip.id, form.name)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-coral-500 hover:bg-coral-600 text-white shadow-xs transition"
            >
              <Share2 className="w-4 h-4" />
              שיתוף לינק לקבוצה
            </button>
          </div>
        </div>

        {/* Shareable Link Banner */}
        <div className="bg-gradient-to-l from-forest-50 to-sun-50 border border-forest-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-forest-700 uppercase tracking-wider">לינק שיתוף להורים</div>
            <div className="text-sm text-slate-700 font-mono mt-0.5 select-all">{shareUrl}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl);
              showToast('הלינק הועתק! 📋');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            העתקת לינק
          </button>
        </div>

        {/* Trip Editor Card */}
        <form onSubmit={handleSaveTrip} className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden">
          <div className="relative h-44 sm:h-52 w-full overflow-hidden">
            <img
              src={tripBanner}
              alt={form.name || 'איור טיול'}
              className="w-full h-full object-cover transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
            <div className="absolute bottom-4 right-6 left-6 flex flex-wrap items-end justify-between gap-3 text-white">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-medium mb-1">
                  <Sparkles className="w-3 h-3" />
                  איור הטיול מתעדכן אוטומטית לפי השם והיעד
                </span>
                <h1 className="text-2xl font-extrabold drop-shadow-xs">{form.name || 'טיול חדש'}</h1>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">עריכת פרטי הטיול</h2>
                {dateLabel && <p className="text-sm text-slate-500 mt-0.5">{dateLabel}</p>}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-500 hover:bg-forest-600 text-white font-semibold text-sm shadow-xs transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'שומר...' : 'שמירת שינויים'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">שם / נושא הטיול *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="למשל: טיול סתיו לרמת הגולן / קמפינג במדבר"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">תאריכי הטיול</label>
                <DateRangePicker
                  startDate={form.start_date}
                  endDate={form.end_date}
                  onChange={({ start_date, end_date }) => setForm({ ...form, start_date, end_date })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מקום הלינה</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={form.lodging}
                    onChange={(e) => setForm({ ...form, lodging: e.target.value })}
                    placeholder="חניון ירוק / קמפינג / צימרים..."
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מסלולי הטיול</label>
                <textarea
                  rows={3}
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="פירוט המסלולים המתוכננים..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">מידע נוסף / לו״ז / הערות</label>
                <textarea
                  rows={3}
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                  placeholder="שעת מפגש, ציוד מומלץ, נקודות חשובות..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  const familyModalDuplicate = familyModal
    ? findDuplicateFamily(familyModal.name, families, familyModal.id)
    : null;

  return (
    <div className="space-y-8">
      {/* Static Owner / Creator Hero Card */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden grid grid-cols-1 md:grid-cols-5">
        <div className="md:col-span-3 p-6 sm:p-8 flex flex-col justify-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-50 text-forest-700 text-xs font-semibold w-fit">
            <Compass className="w-3.5 h-3.5" />
            מערכת מארגן הטיולים
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">ניהול ותכנון טיולי הכיתה</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              צרו טיול חדש, הגדירו מסלולים ומקום לינה, ושתפו לינק ישיר לקבוצת הוואטסאפ של הטיול להרשמה וחלוקת תפקידים.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setNewModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-semibold text-sm shadow-sm shadow-coral-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              יצירת טיול חדש
            </button>
          </div>
        </div>
        <div className="md:col-span-2 h-48 md:h-auto relative">
          <img
            src="/img/creator.jpg"
            alt="תכנון טיול"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Trips List Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">הטיולים שלנו ({trips.length})</h2>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
            <Compass className="w-10 h-10 text-forest-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">עדיין לא נוצרו טיולים</h3>
            <p className="text-sm text-slate-500">צרו את הטיול הראשון ושתפו את הלינק עם המשפחות</p>
            <button
              type="button"
              onClick={() => setNewModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-500 hover:bg-forest-600 text-white font-semibold text-sm transition"
            >
              <Plus className="w-4 h-4" />
              יצירת טיול חדש
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {trips.map((t) => {
              const c = counts.find((x) => x.trip_id === t.id) || { families: 0, people: 0 };
              const dateStr = formatHebrewRange(t.start_date, t.end_date);
              const thumb = getTripImage(t);
              return (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 flex flex-wrap items-center justify-between gap-4 hover:border-slate-200 transition"
                >
                  <div className="flex items-center gap-4">
                    <a href={`#/admin/${t.id}`} className="shrink-0">
                      <img
                        src={thumb}
                        alt={t.name}
                        className="w-20 h-16 sm:w-24 sm:h-16 rounded-xl object-cover border border-slate-100"
                      />
                    </a>
                    <div className="space-y-1">
                      <a href={`#/admin/${t.id}`} className="text-lg font-bold text-slate-800 hover:text-forest-600">
                        {t.name}
                      </a>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {dateStr && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-coral-500" />
                            {dateStr}
                          </span>
                        )}
                        {t.lodging && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-forest-500" />
                            {t.lodging}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-700 font-medium">
                          {c.families} משפחות · {c.people} משתתפים
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => shareTrip(t.id, t.name)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sun-100 hover:bg-sun-500/30 text-amber-900 font-semibold text-xs transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      שיתוף לינק
                    </button>
                    <a
                      href={`#/trip/${t.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
                    >
                      דף משפחות
                    </a>
                    <a
                      href={`#/admin/${t.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white font-semibold text-xs transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      עריכה
                    </a>
                    <button
                      type="button"
                      onClick={() => requestDeleteTrip(t)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="מחיקה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Registered Families Management Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-forest-600" />
            <h2 className="text-xl font-bold text-slate-800">משפחות רשומות ({families.length})</h2>
          </div>
          <button
            type="button"
            onClick={() => setFamilyModal({ name: '', adults: 4, notes: '' })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-forest-500 text-slate-700 font-semibold text-xs shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            הוספת משפחה
          </button>
        </div>

        {families.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-sm text-slate-400">
            עדיין אין משפחות רשומות במערכת. משפחות יתווספו אוטומטית כשהן נרשמות לטיול, או שניתן להוסיף אותן מכאן.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <div className="divide-y divide-slate-100">
              {families.map((f) => {
                const isDup = !!findDuplicateFamily(f.name, families, f.id);
                const count = (f.adults || 0) + (f.kids || 0);
                return (
                  <div
                    key={f.id}
                    className={`px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 transition ${
                      isDup ? 'bg-red-50/50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold text-slate-800 text-sm">{f.name}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-700 text-xs font-medium">
                        {count} נפשות
                      </span>
                      {f.notes && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs">
                          🥗 {f.notes}
                        </span>
                      )}
                      {isDup && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          שם משפחה כפול – מומלץ לערוך ולהוסיף שמות פרטיים
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setFamilyModal({
                            id: f.id,
                            name: f.name,
                            adults: count || 4,
                            notes: f.notes || '',
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        עריכה
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteFamily(f)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="מחיקת משפחה"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <Modal open={newModalOpen} onClose={() => setNewModalOpen(false)} title="יצירת טיול חדש ⛺">
        <form onSubmit={handleCreateTrip} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שם / נושא הטיול *</label>
            <input
              type="text"
              autoFocus
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="למשל: טיול סתיו לרמת הגולן"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תאריכי הטיול</label>
            <DateRangePicker
              startDate={newForm.start_date}
              endDate={newForm.end_date}
              onChange={({ start_date, end_date }) => setNewForm({ ...newForm, start_date, end_date })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">מקום הלינה</label>
            <input
              type="text"
              value={newForm.lodging}
              onChange={(e) => setNewForm({ ...newForm, lodging: e.target.value })}
              placeholder="חניון / קמפינג..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">מסלולי הטיול</label>
            <textarea
              rows={2}
              value={newForm.destination}
              onChange={(e) => setNewForm({ ...newForm, destination: e.target.value })}
              placeholder="פירוט קצר של המסלולים..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-sm font-semibold"
            >
              {saving ? 'יוצר...' : 'יצירת טיול'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit / Create Family Modal */}
      <Modal
        open={!!familyModal}
        onClose={() => setFamilyModal(null)}
        title={familyModal?.id ? 'עריכת פרטי משפחה 👨‍👩‍👧‍👦' : 'הוספת משפחה חדשה 👨‍👩‍👧‍👦'}
      >
        {familyModal && (
          <form onSubmit={handleSaveFamily} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                שם משפחה (מומלץ להוסיף שמות להבדלה) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={familyModal.name}
                  onChange={(e) => setFamilyModal({ ...familyModal, name: e.target.value })}
                  aria-invalid={familyModalDuplicate ? 'true' : undefined}
                  aria-describedby={familyModalDuplicate ? 'admin-family-dup-error' : undefined}
                  placeholder="למשל: כהן (דני ומיכל)"
                  className={`w-full px-3.5 py-2.5 rounded-xl border transition focus:outline-none ${
                    familyModalDuplicate
                      ? 'border-red-500 bg-red-50/40 text-red-900 pl-10 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15'
                  }`}
                />
                {familyModalDuplicate && (
                  <AlertCircle className="w-5 h-5 text-red-500 absolute left-3 top-2.5" />
                )}
              </div>
              {familyModalDuplicate && (
                <p
                  id="admin-family-dup-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1"
                >
                  <span>❗</span>
                  <span>
                    שם המשפחה ״{familyModalDuplicate.name}״ כבר קיים במערכת. אנא הוסיפו גם שמות פרטיים כדי שיהיה ייחודי (למשל: {familyModal.name.trim()} - דני ומיכל).
                  </span>
                </p>
              )}
            </div>

            <div className="bg-cream rounded-2xl p-3.5 flex items-center justify-between border border-slate-200/70">
              <div>
                <div className="text-sm font-semibold text-slate-800">מספר נפשות (ברירת מחדל)</div>
                <div className="text-xs text-slate-500">ניתן לעדכן בכל טיול בנפרד</div>
              </div>
              <div className="flex items-center gap-3 bg-white px-2.5 py-1.5 rounded-full border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFamilyModal({ ...familyModal, adults: (familyModal.adults || 1) + 1 })}
                  className="w-8 h-8 rounded-full bg-forest-50 text-forest-600 hover:bg-forest-100 flex items-center justify-center font-bold transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center font-bold text-lg text-slate-800">{familyModal.adults}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFamilyModal({ ...familyModal, adults: Math.max(1, (familyModal.adults || 1) - 1) })
                  }
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">רגישויות / הערות אוכל</label>
              <input
                type="text"
                value={familyModal.notes}
                onChange={(e) => setFamilyModal({ ...familyModal, notes: e.target.value })}
                placeholder="צמחוני, ללא גלוטן, אלרגיה..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {familyModal.id ? (
                <button
                  type="button"
                  onClick={() => requestDeleteFamily(familyModal)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  מחיקת משפחה
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFamilyModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={saving || !!familyModalDuplicate}
                  className="px-5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'שומר...' : 'שמירה'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDeleteModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={executeConfirmedDelete}
        title={confirmDelete?.title}
        message={confirmDelete?.message}
        loading={deleting}
      />
    </div>
  );
}
