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

// До какой даты прошлое заморожено и с какой смены имеет смысл объявлять цену.
export interface PriceWindow {
  locked_until: string | null;
  next_shift: {
    shift_id: number;
    name: string | null;
    start_date: string;
  } | null;
}
