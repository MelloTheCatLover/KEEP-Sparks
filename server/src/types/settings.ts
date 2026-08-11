// A scoring action and its point value (the multiplier for achievements.amount).
//
// Цена достижения версионируется: `setting_price (setting_id, valid_from,
// value)`, а расчёт берёт версию, действовавшую на дату НАЧАЛА смены. Поэтому
// смена прайса никогда не переписывает уже выданные искры — новые правила
// начинают действовать со следующей смены.
export interface SettingPrice {
  valid_from: string; // YYYY-MM-DD, дата начала действия
  value: number;
}

export interface Setting {
  id: number;
  name: string;
  value: number; // последняя версия — цена, по которой пойдут новые смены
  effective_value: number; // цена, действующая сегодня
  prices: SettingPrice[]; // все версии, новые сверху
}

// Окно, в котором цену можно менять, не трогая прошлое. `locked_until` — дата
// начала последней смены, которая уже отдала искры детям (в рейтинге или с
// раскрытыми днями): новая версия цены должна начинаться строго позже.
export interface PriceWindow {
  locked_until: string | null;
  next_shift: {
    shift_id: number;
    name: string | null;
    start_date: string;
  } | null; // ближайшая смена, которая ещё не отдавала искры
}
