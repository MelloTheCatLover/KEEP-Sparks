// Mirror of server types/settings.ts.

// Цена достижения версионируется по датам: расчёт берёт версию, действовавшую
// на дату начала смены, поэтому новый прайс не трогает уже выданные искры.
export interface SettingPrice {
  valid_from: string; // YYYY-MM-DD
  value: number;
}

export interface Setting {
  id: number;
  name: string;
  value: number; // последняя версия — цена будущих смен
  effective_value: number; // цена, действующая сегодня
  prices: SettingPrice[]; // версии, новые сверху
}

// Легенда «за что искры» для ребёнка: каталог с ценами конкретной смены плюс её
// коэффициент сложности.
export interface LegendShift {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  person_count: number;
  difficulty: number;
  state: "current" | "next" | "past";
}

export interface LegendItem {
  name: string;
  value: number;
}

export interface Legend {
  shift: LegendShift | null;
  items: LegendItem[];
}

// До какой даты прошлое заморожено и с какой смены имеет смысл объявлять цену.
export interface PriceWindow {
  locked_until: string | null;
  next_shift: {
    shift_id: number;
    name: string | null;
    start_date: string;
  } | null;
}
