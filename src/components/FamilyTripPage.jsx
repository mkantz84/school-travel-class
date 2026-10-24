import React, { useState, useEffect } from 'react';
import {
  Tent, Calendar, MapPin, Compass, Users, Utensils, Wrench, Wallet,
  Plus, Minus, Check, Trash2, Edit3, Share2, AlertCircle, UserPlus, LogOut, Backpack
} from 'lucide-react';
import { api, formatMoney, getTripImage, findDuplicateFamily } from '../api';
import { formatHebrewRange } from './DateRangePicker';
import CustomSelect from './CustomSelect';
import Modal, { ConfirmDeleteModal } from './Modal';

function parseSplitIds(raw, defaultIds) {
  if (!raw) return defaultIds;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(Number).filter(Boolean);
    }
  } catch (_) {
    // fallback to defaultIds
  }
  return defaultIds;
}

export default function FamilyTripPage({
  tripId,
  families,
  meId,
  setMeId,
  switchingFamily,
  setSwitchingFamily,
  onRefreshBase,
  showToast,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Onboarding state
  const [selectedFam, setSelectedFam] = useState('new');
  const [newFamName, setNewFamName] = useState('');
  const [headcount, setHeadcount] = useState(4);
  const [notes, setNotes] = useState('');

  // Modals state
  const [roleModal, setRoleModal] = useState(null); // { id?, title, responsible, menu }
  const [gearModal, setGearModal] = useState(false);
  const [gearForm, setGearForm] = useState({ item: '', needed_for: '', i_bring: false });
  const [expenseModal, setExpenseModal] = useState(null); // { id?, family_id, amount, description, split_ids }
  const [confirmDelete, setConfirmDelete] = useState(null); // { title, message, confirmLabel, onConfirm }
  const [deleting, setDeleting] = useState(false);

  const loadTrip = async () => {
    const d = await api('trips/' + tripId);
    setData(d);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadTrip();
  }, [tripId]);

  const myFamily = families.find((f) => f.id === Number(meId)) || null;
  const isJoined = localStorage.getItem(`joinedTrip_${tripId}`) === '1' && !!myFamily;

  // Sync onboarding defaults when families or data load
  useEffect(() => {
    if (!data) return;
    if (myFamily) {
      setSelectedFam(String(myFamily.id));
      const p = data.participants.find((x) => x.family_id === myFamily.id);
      setHeadcount(p ? p.adults + p.kids : myFamily.adults + myFamily.kids);
      setNotes(myFamily.notes || '');
    } else if (families.length > 0) {
      setSelectedFam('new');
      setHeadcount(4);
      setNotes('');
    }
  }, [data, myFamily?.id, families.length]);

  const handleSelectFamilyChange = (val) => {
    setSelectedFam(val);
    if (val === 'new') {
      setHeadcount(4);
      setNotes('');
    } else {
      const f = families.find((x) => String(x.id) === String(val));
      const p = data?.participants.find((x) => String(x.family_id) === String(val));
      setHeadcount(p ? p.adults + p.kids : f ? f.adults + f.kids : 4);
      setNotes(f?.notes || '');
    }
  };

  const duplicateNewFam =
    selectedFam === 'new' ? findDuplicateFamily(newFamName, families) : null;

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    let famId = selectedFam;

    if (selectedFam === 'new') {
      if (!newFamName.trim()) {
        showToast('נא להזין שם משפחה');
        return;
      }
      if (duplicateNewFam) {
        showToast('שם המשפחה כבר קיים – נא להוסיף שמות פרטיים');
        return;
      }
      try {
        const created = await api('families', 'POST', {
          name: newFamName.trim(),
          adults: headcount,
          kids: 0,
          notes: notes.trim(),
        });
        famId = created.id;
      } catch (err) {
        showToast(err.message);
        return;
      }
    } else {
      famId = Number(selectedFam);
    }

    await api(`trips/${tripId}/participants/${famId}`, 'PUT', {
      adults: headcount,
      kids: 0,
      notes: notes.trim(),
    });

    setMeId(famId);
    localStorage.setItem(`joinedTrip_${tripId}`, '1');
    setSwitchingFamily(false);
    await onRefreshBase();
    await loadTrip();
    showToast('נרשמתם לטיול! 🎉');
  };

  const requestLeaveTrip = () => {
    if (!myFamily) return;
    setConfirmDelete({
      title: 'ביטול הגעה לטיול',
      message: `האם אתם בטוחים שברצונכם להסיר את משפחת "${myFamily.name}" מרשימת המשתתפים בטיול?`,
      confirmLabel: 'כן, בטלו הגעה',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api(`trips/${tripId}/participants/${myFamily.id}`, 'DELETE');
          localStorage.removeItem(`joinedTrip_${tripId}`);
          setConfirmDelete(null);
          await onRefreshBase();
          await loadTrip();
          showToast('הגעתכם לטיול בוטלה');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  if (loading || !data) {
    return <div className="py-16 text-center text-slate-400">טוען נתוני טיול... 🌿</div>;
  }

  const { trip, participants, meals, gear = [], expenses } = data;
  const dateLabel = formatHebrewRange(trip.start_date, trip.end_date);
  const tripImage = getTripImage(trip);

  // ====================================================================
  // STEP 1: Simple Family Login / Registration Card
  // ====================================================================
  if (!isJoined || switchingFamily) {
    const familyOptions = [
      { value: 'new', label: '➕ רישום משפחה חדשה' },
      ...families.map((f) => ({ value: String(f.id), label: f.name })),
    ];

    return (
      <div className="max-w-md mx-auto mt-4">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="relative h-44 w-full">
            <img
              src={tripImage}
              alt={trip.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />
            <div className="absolute bottom-3.5 right-5 left-5 text-white">
              {dateLabel && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/25 backdrop-blur-xs text-white text-xs font-semibold mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateLabel}
                </span>
              )}
              <h1 className="text-2xl font-extrabold drop-shadow-xs">{trip.name}</h1>
            </div>
          </div>

          <form onSubmit={handleJoinSubmit} className="p-6 md:p-7 space-y-4">
            {families.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">בחירת משפחה</label>
                <CustomSelect
                  options={familyOptions}
                  value={selectedFam}
                  onChange={handleSelectFamilyChange}
                  placeholder="בחרו משפחה מהרשימה או צרו חדשה..."
                />
              </div>
            )}

            {selectedFam === 'new' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  שם משפחה (מומלץ להוסיף שמות פרטיים) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    value={newFamName}
                    onChange={(e) => setNewFamName(e.target.value)}
                    aria-invalid={duplicateNewFam ? 'true' : undefined}
                    aria-describedby={duplicateNewFam ? 'family-dup-note' : undefined}
                    placeholder="למשל: כהן (דני ומיכל)"
                    className={`w-full px-3.5 py-2.5 rounded-xl border transition focus:outline-none ${
                      duplicateNewFam
                        ? 'border-red-500 bg-red-50/40 text-red-900 pl-10 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15'
                    }`}
                  />
                  {duplicateNewFam && (
                    <AlertCircle className="w-5 h-5 text-red-500 absolute left-3 top-2.5" />
                  )}
                </div>
                {duplicateNewFam && (
                  <p
                    id="family-dup-note"
                    role="alert"
                    className="mt-1.5 text-xs font-medium text-red-600 flex items-start gap-1"
                  >
                    <span>❗</span>
                    <span>
                      שם המשפחה ״{duplicateNewFam.name}״ כבר קיים במערכת. אנא הוסיפו גם שמות פרטיים כדי שיהיה ייחודי (למשל: {newFamName.trim()} - דני ומיכל).
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="bg-cream rounded-2xl p-4 flex items-center justify-between border border-slate-200/70">
              <div>
                <div className="text-sm font-semibold text-slate-800">מספר משתתפים</div>
                <div className="text-xs text-slate-500">כמה נפשות מגיעות לטיול?</div>
              </div>
              <div className="flex items-center gap-3 bg-white px-2.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setHeadcount((c) => c + 1)}
                  className="w-8 h-8 rounded-full bg-forest-50 text-forest-600 hover:bg-forest-100 flex items-center justify-center font-bold transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center font-bold text-lg text-slate-800">{headcount}</span>
                <button
                  type="button"
                  onClick={() => setHeadcount((c) => Math.max(1, c - 1))}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">רגישויות / הערות אוכל</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="צמחוני, ללא גלוטן, אלרגיה..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
              />
            </div>

            <button
              type="submit"
              disabled={selectedFam === 'new' && !!duplicateNewFam}
              className="w-full py-3 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-bold text-base shadow-md shadow-coral-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              כניסה והרשמה לטיול ←
            </button>

            {switchingFamily && isJoined && (
              <button
                type="button"
                onClick={() => setSwitchingFamily(false)}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                חזרה לדף הטיול
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ====================================================================
  // STEP 2: Streamlined Single-Page Trip Dashboard
  // ====================================================================
  const totalPeople = participants.reduce((s, p) => s + p.adults + p.kids, 0);
  const myGearItems = gear.filter((g) => g.brought_by === myFamily.name);
  const myAssignedRoles = meals.filter((m) => m.responsible === myFamily.name);

  // Roles handlers
  const handleTakeRole = async (roleId) => {
    await api('meals/' + roleId, 'PUT', { responsible: myFamily.name });
    await loadTrip();
  };

  const requestRemoveRole = (role) => {
    setConfirmDelete({
      title: 'הסרת אחריות מתפקיד',
      message: `האם אתם בטוחים שברצונכם להסיר את "${role.responsible}" מאחריות על "${role.title}"?`,
      confirmLabel: 'כן, הסירו אחריות',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api('meals/' + role.id, 'PUT', { responsible: '', phone: '' });
          setConfirmDelete(null);
          await loadTrip();
          showToast('האחריות הוסרה מהתפקיד');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleModal.title.trim()) return;
    if (roleModal.id) {
      await api('meals/' + roleModal.id, 'PUT', {
        title: roleModal.title,
        responsible: roleModal.responsible,
        menu: roleModal.menu,
      });
    } else {
      await api(`trips/${tripId}/meals`, 'POST', {
        title: roleModal.title,
        responsible: roleModal.responsible,
        menu: roleModal.menu,
      });
    }
    setRoleModal(null);
    await loadTrip();
  };

  const requestDeleteRole = (role) => {
    setConfirmDelete({
      title: 'מחיקת תפקיד',
      message: `האם אתם בטוחים שברצונכם למחוק את התפקיד "${role.title}" מהטיול?`,
      confirmLabel: 'כן, מחקו תפקיד',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api('meals/' + role.id, 'DELETE');
          setConfirmDelete(null);
          setRoleModal(null);
          await loadTrip();
          showToast('התפקיד נמחק 🗑️');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // Gear handlers
  const handleAddGear = async (e) => {
    e.preventDefault();
    if (!gearForm.item.trim()) return;
    await api(`trips/${tripId}/gear`, 'POST', {
      item: gearForm.item.trim(),
      needed_for: gearForm.needed_for,
      brought_by: gearForm.i_bring ? myFamily.name : '',
    });
    setGearForm({ item: '', needed_for: '', i_bring: false });
    setGearModal(false);
    await loadTrip();
  };

  const handleClaimGear = async (id) => {
    await api('gear/' + id, 'PUT', { brought_by: myFamily.name });
    await loadTrip();
  };

  const requestUnclaimGear = (gearItem) => {
    setConfirmDelete({
      title: 'הסרת אחריות מפריט',
      message: `האם אתם בטוחים שברצונכם להסיר את האחריות של "${gearItem.brought_by}" מהבאת "${gearItem.item}"?`,
      confirmLabel: 'כן, הסירו אחריות',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api('gear/' + gearItem.id, 'PUT', { brought_by: '' });
          setConfirmDelete(null);
          await loadTrip();
          showToast('האחריות הוסרה מהפריט');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const requestDeleteGear = (gearItem) => {
    setConfirmDelete({
      title: 'מחיקת פריט מרשימת הציוד',
      message: `האם אתם בטוחים שברצונכם למחוק את "${gearItem.item}" מרשימת הכלים והמצרכים?`,
      confirmLabel: 'כן, מחקו פריט',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api('gear/' + gearItem.id, 'DELETE');
          setConfirmDelete(null);
          await loadTrip();
          showToast('הפריט נמחק 🗑️');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // Expenses calculation & handlers (Splitwise-style per-expense family selection)
  const incExpenses = expenses.filter((e) => e.included);
  const totalExpenses = incExpenses.reduce((s, e) => s + e.amount, 0);
  const peopleByFam = Object.fromEntries(participants.map((p) => [p.family_id, p.adults + p.kids]));
  const sharePerPerson = totalPeople ? totalExpenses / totalPeople : 0;

  // Default families for splitting: all trip participants (or all families if none joined yet)
  const defaultSplitIds =
    participants.length > 0
      ? participants.map((p) => Number(p.family_id))
      : families.map((f) => Number(f.id));

  // Calculate how much each family owes across all expenses (proportional to family size in each expense)
  const owedByFam = {};
  const paidByFam = {};
  const involvedSet = new Set(participants.map((p) => Number(p.family_id)));

  for (const e of incExpenses) {
    const payerId = Number(e.family_id);
    involvedSet.add(payerId);
    paidByFam[payerId] = (paidByFam[payerId] || 0) + Number(e.amount);

    const splitIds = parseSplitIds(e.split_families, defaultSplitIds);
    for (const fid of splitIds) involvedSet.add(Number(fid));

    const getWeight = (fid) => {
      if (peopleByFam[fid] !== undefined) return peopleByFam[fid];
      const f = families.find((x) => x.id === Number(fid));
      return f ? (f.adults || 0) + (f.kids || 0) || 1 : 1;
    };

    const expPeople = splitIds.reduce((sum, fid) => sum + getWeight(fid), 0);
    if (expPeople > 0) {
      for (const fid of splitIds) {
        const w = getWeight(fid);
        owedByFam[fid] = (owedByFam[fid] || 0) + Number(e.amount) * (w / expPeople);
      }
    }
  }

  const allInvolvedIds = [...involvedSet];
  const balanceRows = allInvolvedIds
    .map((fid) => {
      const f = families.find((x) => x.id === Number(fid));
      const n =
        peopleByFam[fid] !== undefined
          ? peopleByFam[fid]
          : f
          ? (f.adults || 0) + (f.kids || 0)
          : 0;
      const paid = paidByFam[fid] || 0;
      const owe = owedByFam[fid] || 0;
      return { id: fid, name: f?.name || 'משפחה', n, paid, owe, bal: owe - paid };
    })
    .sort((a, b) => b.bal - a.bal);

  const debtors = balanceRows.filter((r) => r.bal > 0.01).map((r) => ({ ...r, left: r.bal }));
  const creditors = balanceRows.filter((r) => r.bal < -0.01).map((r) => ({ ...r, left: -r.bal })).sort((a, b) => b.left - a.left);
  const transfers = [];
  for (const d of debtors) {
    for (const c of creditors) {
      if (d.left < 0.01) break;
      if (c.left < 0.01) continue;
      const amt = Math.min(d.left, c.left);
      transfers.push({ from: d.name, to: c.name, amt });
      d.left -= amt;
      c.left -= amt;
    }
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const amountNum = Number(expenseModal.amount);
    if (!expenseModal.description.trim() || !(amountNum > 0)) {
      showToast('נא למלא סכום ופירוט');
      return;
    }
    const splitIds = expenseModal.split_ids || [];
    if (splitIds.length === 0) {
      showToast('נא לבחור לפחות משפחה אחת שמשתתפת בהוצאה');
      return;
    }
    const isAllDefault =
      splitIds.length === defaultSplitIds.length &&
      defaultSplitIds.every((id) => splitIds.includes(Number(id)));

    const payload = {
      family_id: Number(expenseModal.family_id),
      amount: amountNum,
      description: expenseModal.description.trim(),
      included: 1,
      split_families: isAllDefault ? '' : JSON.stringify(splitIds.map(Number)),
    };
    if (expenseModal.id) {
      await api('expenses/' + expenseModal.id, 'PUT', payload);
    } else {
      await api(`trips/${tripId}/expenses`, 'POST', payload);
    }
    setExpenseModal(null);
    await loadTrip();
  };

  const requestDeleteExpense = (expense) => {
    setConfirmDelete({
      title: 'מחיקת הוצאה',
      message: `האם אתם בטוחים שברצונכם למחוק את ההוצאה "${expense.description}" (${formatMoney(expense.amount)})?`,
      confirmLabel: 'כן, מחקו הוצאה',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await api('expenses/' + expense.id, 'DELETE');
          setConfirmDelete(null);
          setExpenseModal(null);
          await loadTrip();
          showToast('ההוצאה נמחקה 🗑️');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const toggleExpenseSplitFamily = (fid) => {
    const numId = Number(fid);
    const current = expenseModal?.split_ids || [];
    const exists = current.includes(numId);
    const next = exists ? current.filter((x) => x !== numId) : [...current, numId];
    setExpenseModal({ ...expenseModal, split_ids: next });
  };

  const shareSettlementWhatsApp = () => {
    const text = [
      `💰 *סיכום הוצאות – ${trip.name}*`,
      `סך הוצאות: ${formatMoney(totalExpenses)} · משתתפים: ${totalPeople}`,
      '',
      ...transfers.map((x) => `• ${x.from} ← ${x.to}: ${formatMoney(x.amt)}`),
    ].join('\n');
    navigator.clipboard?.writeText(text).then(() => showToast('הועתק! 📋'), () => {});
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  const familySelectOptions = [
    { value: '', label: '— ללא אחראי —' },
    ...families.map((f) => ({ value: f.name, label: f.name })),
  ];

  const payerSelectOptions = families.map((f) => ({ value: String(f.id), label: f.name }));
  const mealSelectOptions = [
    { value: '', label: 'כללי' },
    ...meals.map((m) => ({ value: m.title, label: m.title })),
  ];

  // Candidate families to show in Expense split selector (trip participants first, plus any other families)
  const splitCandidateFamilies =
    participants.length > 0
      ? participants
          .map((p) => {
            const f = families.find((x) => x.id === p.family_id);
            return f ? { id: f.id, name: f.name, count: p.adults + p.kids } : null;
          })
          .filter(Boolean)
      : families.map((f) => ({ id: f.id, name: f.name, count: (f.adults || 0) + (f.kids || 0) }));

  return (
    <div className="space-y-8">
      {/* 1. Trip Header & Info */}
      <section className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden">
        <div className="relative h-48 sm:h-60 w-full">
          <img
            src={tripImage}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/25 to-transparent" />
          <div className="absolute bottom-4 right-6 left-6 flex flex-wrap items-end justify-between gap-3 text-white">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-extrabold drop-shadow-xs">{trip.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {dateLabel && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-xs font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    {dateLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-xs font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  {participants.length} משפחות · {totalPeople} משתתפים
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 bg-gradient-to-br from-forest-50/40 via-white to-sun-50/40">
          {(trip.lodging || trip.destination || trip.schedule) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trip.lodging && (
                <div className="bg-white rounded-2xl p-3.5 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-700 mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    מקום הלינה
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{trip.lodging}</div>
                </div>
              )}
              {trip.destination && (
                <div className={`bg-white rounded-2xl p-3.5 border border-slate-100 ${trip.lodging ? '' : 'md:col-span-2'}`}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-700 mb-1">
                    <Compass className="w-3.5 h-3.5" />
                    מסלולי הטיול
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{trip.destination}</div>
                </div>
              )}
              {trip.schedule && (
                <div className="bg-white rounded-2xl p-3.5 border border-slate-100 md:col-span-2">
                  <div className="text-xs font-semibold text-forest-700 mb-1">פרטים נוספים</div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{trip.schedule}</div>
                </div>
              )}
            </div>
          )}

          {/* Participants Pills */}
          <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {participants.map((p) => {
                const f = families.find((x) => x.id === p.family_id);
                if (!f) return null;
                const isMe = f.id === myFamily.id;
                return (
                  <span
                    key={f.id}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      isMe
                        ? 'bg-forest-500 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    {f.name} ({p.adults + p.kids})
                    {f.notes ? ` · 🥗 ${f.notes}` : ''}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={requestLeaveTrip}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              ביטול הגעה
            </button>
          </div>
        </div>
      </section>

      {/* 1.5 My Family's Personal Packing / Responsibility List */}
      <section className="bg-gradient-to-l from-forest-50 via-white to-sun-50/70 rounded-3xl p-5 sm:p-6 border border-forest-200/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-forest-500 text-white flex items-center justify-center shadow-2xs">
              <Backpack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                מה באחריותנו להכין ולהביא? ({myFamily.name})
              </h2>
              <p className="text-xs text-slate-500">
                ריכוז אישי של הכלים, המצרכים והתפקידים שלקחתם על עצמכם לטיול
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setGearForm({ item: '', needed_for: '', i_bring: true });
              setGearModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-forest-200 hover:border-forest-500 text-forest-700 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            הוספת כלי / פריט שאנחנו מביאים
          </button>
        </div>

        {myGearItems.length === 0 && myAssignedRoles.length === 0 ? (
          <div className="bg-white/80 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            עדיין לא משויכים אליכם כלים או תפקידים. כל כלי או מצרך שתסמנו ״אנחנו נביא!״ ברשימה למטה יופיע כאן באופן אוטומטי כדי שתוכלו להתארגן בקלות ליציאה.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* My Tools & Items to Bring */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-forest-700 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  כלים ומצרכים להבאה ({myGearItems.length})
                </span>
              </div>
              {myGearItems.length === 0 ? (
                <p className="text-xs text-slate-400">לא נבחרו כלים או מצרכים להבאה עדיין.</p>
              ) : (
                <ul className="space-y-1.5">
                  {myGearItems.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-2 bg-forest-50/60 px-3 py-2 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-forest-500 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                        <span className="font-bold text-slate-800">{g.item}</span>
                        {g.needed_for && (
                          <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200/80 text-[11px]">
                            {g.needed_for}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => requestUnclaimGear(g)}
                        className="text-[11px] text-slate-400 hover:text-red-600 transition"
                      >
                        הסרה
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* My Assigned Meals / Roles */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-coral-600 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" />
                  תפקידים וארוחות באחריותנו ({myAssignedRoles.length})
                </span>
              </div>
              {myAssignedRoles.length === 0 ? (
                <p className="text-xs text-slate-400">לא לקחתם אחריות על ארוחה או תפקיד עדיין.</p>
              ) : (
                <ul className="space-y-1.5">
                  {myAssignedRoles.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 bg-coral-50/50 px-3 py-2 rounded-xl text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{m.title}</div>
                        {m.menu && <div className="text-slate-500 mt-0.5">{m.menu}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRoleModal(m)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                      >
                        עריכת תפריט
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Roles Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-coral-500" />
            <h2 className="text-xl font-bold text-slate-800">תפקידים וארוחות</h2>
          </div>
          <button
            type="button"
            onClick={() => setRoleModal({ title: '', responsible: myFamily.name, menu: '' })}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-forest-500 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            תפקיד נוסף
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {meals.map((m) => {
            const isOpen = !m.responsible;
            return (
              <div
                key={m.id}
                className={`rounded-2xl p-4 flex flex-col justify-between gap-3 transition ${
                  isOpen
                    ? 'bg-white border-2 border-dashed border-coral-500/60'
                    : 'bg-white border border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-800">{m.title}</h3>
                    <button
                      type="button"
                      onClick={() => setRoleModal(m)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="עריכה"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {m.menu && <p className="text-xs text-slate-600 whitespace-pre-wrap">{m.menu}</p>}
                </div>

                {isOpen ? (
                  <button
                    type="button"
                    onClick={() => handleTakeRole(m.id)}
                    className="w-full py-2 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-semibold text-xs transition"
                  >
                    אני לוקח/ת אחריות!
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 bg-forest-50 px-3 py-2 rounded-xl">
                    <span className="text-xs font-bold text-forest-700 truncate">👤 {m.responsible}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRoleModal(m)}
                        className="px-2 py-0.5 rounded-md bg-white text-slate-600 hover:text-slate-900 text-[11px] font-medium border border-slate-200"
                      >
                        פירוט
                      </button>
                      <button
                        type="button"
                        onClick={() => requestRemoveRole(m)}
                        className="px-2 py-0.5 rounded-md bg-white text-red-600 hover:bg-red-50 text-[11px] font-medium border border-red-200"
                      >
                        הסרה
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Decentralized Cooking Gear & Items Sync */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-forest-600" />
            <h2 className="text-xl font-bold text-slate-800">כלים, מצרכים והשלמות</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setGearForm({ item: '', needed_for: '', i_bring: false });
              setGearModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sun-500 hover:bg-amber-400 text-slate-900 font-semibold text-xs shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            הוספת פריט נדרש
          </button>
        </div>

        {gear.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center text-sm text-slate-400">
            רשמו אילו כלים, ציוד או מצרכים דרושים (ומה עדיין חסר).
          </div>
        ) : (
          <div className="grid gap-2">
            {gear.map((g) => {
              const missing = !g.brought_by;
              return (
                <div
                  key={g.id}
                  className={`rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border ${
                    missing ? 'bg-coral-50/40 border-coral-500/40' : 'bg-white border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">{g.item}</span>
                    {g.needed_for && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                        {g.needed_for}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {missing ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-coral-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          חסר
                        </span>
                        <button
                          type="button"
                          onClick={() => handleClaimGear(g.id)}
                          className="px-3 py-1.5 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-xs font-semibold transition"
                        >
                          אנחנו נביא!
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-forest-50 text-forest-700 text-xs font-semibold">
                          ✔ מביאים: {g.brought_by}
                        </span>
                        <button
                          type="button"
                          onClick={() => requestUnclaimGear(g)}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
                        >
                          ביטול
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => requestDeleteGear(g)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="מחיקת פריט"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Expenses & Proportional Split */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-forest-600" />
            <h2 className="text-xl font-bold text-slate-800">הוצאות והתחשבנות</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setExpenseModal({
                family_id: String(myFamily.id),
                amount: '',
                description: '',
                split_ids: defaultSplitIds,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-semibold text-xs shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            הוספת הוצאה
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-forest-600">{formatMoney(totalExpenses)}</div>
            <div className="text-xs text-slate-500 mt-0.5">סך הוצאות</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-slate-800">{totalPeople}</div>
            <div className="text-xs text-slate-500 mt-0.5">משתתפים</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xl font-extrabold text-coral-500">
              {formatMoney(owedByFam[myFamily.id] || 0)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">החלק שלנו ({myFamily.name})</div>
          </div>
        </div>

        {expenses.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4 text-right font-medium">מי שילם</th>
                  <th className="py-2.5 px-4 text-right font-medium">עבור מה</th>
                  <th className="py-2.5 px-4 text-right font-medium">משתתפים בהוצאה</th>
                  <th className="py-2.5 px-4 text-right font-medium">סכום</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => {
                  const f = families.find((x) => x.id === e.family_id);
                  const splitIds = parseSplitIds(e.split_families, defaultSplitIds);
                  const isAll =
                    !e.split_families ||
                    (splitIds.length === defaultSplitIds.length &&
                      defaultSplitIds.every((id) => splitIds.includes(Number(id))));
                  const splitNames = splitIds
                    .map((id) => families.find((x) => x.id === Number(id))?.name)
                    .filter(Boolean);

                  return (
                    <tr key={e.id}>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{f?.name || 'משפחה'}</td>
                      <td className="py-2.5 px-4 text-slate-600">{e.description}</td>
                      <td className="py-2.5 px-4 text-xs">
                        {isAll ? (
                          <span className="px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 font-medium">
                            כל המשתתפים
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium inline-block max-w-xs truncate"
                            title={splitNames.join(', ')}
                          >
                            {splitNames.length} משפחות: {splitNames.join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">{formatMoney(e.amount)}</td>
                      <td className="py-2.5 px-3 text-left">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpenseModal({
                                id: e.id,
                                family_id: String(e.family_id),
                                amount: e.amount,
                                description: e.description,
                                split_ids: splitIds,
                              })
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="עריכת הוצאה"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteExpense(e)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="מחיקת הוצאה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalExpenses > 0 && balanceRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-700">מאזן לפי גודל משפחה והוצאות</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {balanceRows.map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{r.name}</span>
                      <span className="text-slate-400 mr-1.5">
                        ({r.n} נפשות · שילמו {formatMoney(r.paid)} · חלקם {formatMoney(r.owe)})
                      </span>
                    </div>
                    <span
                      className={`font-bold ${
                        Math.abs(r.bal) < 0.01
                          ? 'text-slate-400'
                          : r.bal > 0
                          ? 'text-coral-600'
                          : 'text-forest-600'
                      }`}
                    >
                      {Math.abs(r.bal) < 0.01
                        ? 'מאוזן'
                        : r.bal > 0
                        ? `לתשלום ${formatMoney(r.bal)}`
                        : `להחזר ${formatMoney(-r.bal)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {transfers.length > 0 && (
              <div className="bg-sun-50/70 rounded-2xl border border-sun-500/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">🤝 מי מעביר למי</h3>
                  <button
                    type="button"
                    onClick={shareSettlementWhatsApp}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Share2 className="w-3 h-3" />
                    שיתוף בוואטסאפ
                  </button>
                </div>
                <div className="space-y-2">
                  {transfers.map((t, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl px-3.5 py-2.5 flex items-center justify-between text-sm shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{t.from}</span>
                        <span className="text-slate-400">←</span>
                        <span className="font-bold text-slate-800">{t.to}</span>
                      </div>
                      <span className="font-extrabold text-forest-600">{formatMoney(t.amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Role Edit/Add Modal */}
      <Modal
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        title={roleModal?.id ? `עריכת ${roleModal.title}` : 'תפקיד חדש'}
      >
        {roleModal && (
          <form onSubmit={handleSaveRole} className="space-y-4">
            {!roleModal.id && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">שם התפקיד *</label>
                <input
                  type="text"
                  autoFocus
                  value={roleModal.title}
                  onChange={(e) => setRoleModal({ ...roleModal, title: e.target.value })}
                  placeholder="למשל: קפה ועוגה / מדורה"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">משפחה אחראית</label>
              <CustomSelect
                options={familySelectOptions}
                value={roleModal.responsible || ''}
                onChange={(val) => setRoleModal({ ...roleModal, responsible: val })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">תפריט / פירוט</label>
              <textarea
                rows={3}
                value={roleModal.menu || ''}
                onChange={(e) => setRoleModal({ ...roleModal, menu: e.target.value })}
                placeholder="מה מכינים..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {roleModal.id ? (
                <button
                  type="button"
                  onClick={() => requestDeleteRole(roleModal)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  מחיקת תפקיד
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-sm font-semibold"
                >
                  שמירה
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Gear / Item Modal */}
      <Modal open={gearModal} onClose={() => setGearModal(false)} title="הוספת פריט נדרש (כלי / מצרכים) 🧺">
        <form onSubmit={handleAddGear} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">מה צריך להביא? *</label>
            <input
              type="text"
              autoFocus
              value={gearForm.item}
              onChange={(e) => setGearForm({ ...gearForm, item: e.target.value })}
              placeholder="למשל: סיר גדול / גזייה / עגבניות / לחם..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">עבור איזו ארוחה / משימה?</label>
            <CustomSelect
              options={mealSelectOptions}
              value={gearForm.needed_for}
              onChange={(val) => setGearForm({ ...gearForm, needed_for: val })}
              isSearchable={false}
            />
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={gearForm.i_bring}
              onChange={(e) => setGearForm({ ...gearForm, i_bring: e.target.checked })}
              className="w-4 h-4 rounded text-forest-500 focus:ring-forest-500"
            />
            <span className="text-sm font-medium text-slate-700">
              אנחנו ({myFamily.name}) מביאים את הפריט הזה
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGearModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-sm font-semibold"
            >
              הוספה
            </button>
          </div>
        </form>
      </Modal>

      {/* Expense Modal */}
      <Modal
        open={!!expenseModal}
        onClose={() => setExpenseModal(null)}
        title={expenseModal?.id ? 'עריכת הוצאה' : 'רישום הוצאה 🧾'}
      >
        {expenseModal && (
          <form onSubmit={handleSaveExpense} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">מי שילם?</label>
              <CustomSelect
                options={payerSelectOptions}
                value={expenseModal.family_id}
                onChange={(val) => setExpenseModal({ ...expenseModal, family_id: val })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סכום (₪) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={expenseModal.amount}
                onChange={(e) => setExpenseModal({ ...expenseModal, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">עבור מה? *</label>
              <input
                type="text"
                value={expenseModal.description}
                onChange={(e) => setExpenseModal({ ...expenseModal, description: e.target.value })}
                placeholder="מצרכים לארוחת ערב..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-forest-500"
              />
            </div>

            {/* Splitwise-style Multi-Select Family Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  עבור אילו משפחות ההוצאה? ({(expenseModal.split_ids || []).length}/{splitCandidateFamilies.length})
                </label>
                {(expenseModal.split_ids || []).length < splitCandidateFamilies.length && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpenseModal({
                        ...expenseModal,
                        split_ids: splitCandidateFamilies.map((f) => Number(f.id)),
                      })
                    }
                    className="text-xs font-semibold text-forest-600 hover:text-forest-700"
                  >
                    בחירת כל המשפחות
                  </button>
                )}
              </div>
              <CustomSelect
                isMulti
                isClearable
                options={splitCandidateFamilies.map((f) => ({
                  value: Number(f.id),
                  label: `${f.name} (${f.count})`,
                }))}
                value={expenseModal.split_ids || []}
                onChange={(vals) =>
                  setExpenseModal({ ...expenseModal, split_ids: (vals || []).map(Number) })
                }
                placeholder="בחרו משפחות שמשתתפות בהוצאה..."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {expenseModal.id ? (
                <button
                  type="button"
                  onClick={() => requestDeleteExpense(expenseModal)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  מחיקת הוצאה
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-sm font-semibold"
                >
                  שמירה
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete / Remove Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={confirmDelete?.onConfirm}
        title={confirmDelete?.title}
        message={confirmDelete?.message}
        confirmLabel={confirmDelete?.confirmLabel}
        loading={deleting}
      />
    </div>
  );
}
