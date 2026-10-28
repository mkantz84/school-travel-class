import React from 'react';
import { Sparkles, Utensils, Wrench, Check } from 'lucide-react';
import Modal from './Modal';

export default function AiSuggestionsModal({
  suggestionsModal,
  selectedSuggestionIds,
  setSelectedSuggestionIds,
  toggleSuggestionSelection,
  approvingSuggestions,
  onApprove,
  onClose,
}) {
  const suggestions = suggestionsModal?.suggestions || [];
  const mealSuggestions = suggestions.filter((s) => s.kind === 'meal');
  const gearSuggestions = suggestions.filter((s) => s.kind === 'gear');

  return (
    <Modal
      open={!!suggestionsModal}
      onClose={() => !approvingSuggestions && onClose()}
      title="✨ הצעות סוכני ה-AI להשלמת תפקידים וציוד"
      maxWidth="max-w-2xl"
    >
      {suggestionsModal && (
        <div className="space-y-4">
          <div className="bg-gradient-to-l from-forest-50 to-sun-50/70 border border-forest-200/70 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-800">
                חישוב מותאם ל-{suggestionsModal.headcount} משתתפים ({suggestionsModal.registered_families} משפחות רשומות)
              </div>
              <div className="text-slate-600">
                סמנו אילו תפקידים, כלים ומצרכים תרצו להוסיף לרשימות הטיול. פריטים שכבר קיימים ברשימה לא הוצעו שוב.
              </div>
            </div>
            {suggestions.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedSuggestionIds(suggestions.map((s) => s.id))}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-forest-700 font-semibold hover:bg-forest-50 transition"
                >
                  בחירת הכל ({suggestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSuggestionIds([])}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
                >
                  ניקוי הכל
                </button>
              </div>
            )}
          </div>

          {suggestions.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-8 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-forest-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                רשימות התפקידים, הכלים והמצרכים כבר מלאות ומותאמות ל-{suggestionsModal.headcount} משתתפים!
              </div>
              <div className="text-xs text-slate-500">
                אם יצטרפו משפחות נוספות או ישתנו פרטי הטיול, תוכלו להפעיל את החישוב שוב.
              </div>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
              {mealSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-coral-600">
                    <Utensils className="w-3.5 h-3.5" />
                    <span>תפקידים וארוחות מומלצים ({mealSuggestions.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {mealSuggestions.map((s) => {
                      const checked = selectedSuggestionIds.includes(s.id);
                      const p = s.payload || {};
                      const mealTitle = s.title || p.title || '';
                      const mealMenu = s.subtitle || p.menu || '';
                      return (
                        <label
                          key={s.id}
                          className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                            checked
                              ? 'bg-coral-50/40 border-coral-500/50'
                              : 'bg-white border-slate-200/80 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSuggestionSelection(s.id)}
                            className="mt-1 w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-800">{mealTitle}</div>
                            {mealMenu && (
                              <div className="text-xs text-slate-600 mt-0.5">{mealMenu}</div>
                            )}
                            {s.reason && (
                              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white border border-slate-200/80 text-[11px] text-slate-500">
                                <span>💡</span>
                                <span>{s.reason}</span>
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {gearSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-forest-700">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>
                      כלים, מצרכים והשלמות לפי כמות משתתפים ({gearSuggestions.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {gearSuggestions.map((s) => {
                      const checked = selectedSuggestionIds.includes(s.id);
                      const p = s.payload || {};
                      const gearItem = s.title || p.item || '';
                      const gearNeededFor = s.needed_for || p.needed_for || '';
                      return (
                        <label
                          key={s.id}
                          className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                            checked
                              ? 'bg-forest-50/50 border-forest-500/40'
                              : 'bg-white border-slate-200/80 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSuggestionSelection(s.id)}
                            className="mt-1 w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-800">{gearItem}</span>
                              {gearNeededFor && (
                                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] text-slate-600">
                                  {gearNeededFor}
                                </span>
                              )}
                            </div>
                            {s.reason && (
                              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white border border-slate-200/80 text-[11px] text-slate-500">
                                <span>💡</span>
                                <span>{s.reason}</span>
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-500">
              {suggestions.length > 0
                ? `נבחרו ${selectedSuggestionIds.length} מתוך ${suggestions.length} הצעות`
                : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={approvingSuggestions}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {suggestions.length === 0 ? 'סגירה' : 'ביטול'}
              </button>
              {suggestions.length > 0 && (
                <button
                  type="button"
                  disabled={selectedSuggestionIds.length === 0 || approvingSuggestions}
                  onClick={onApprove}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-forest-500 hover:bg-forest-600 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {approvingSuggestions
                    ? 'מוסיף לטיול...'
                    : `אישור והוספת הנבחרים (${selectedSuggestionIds.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
