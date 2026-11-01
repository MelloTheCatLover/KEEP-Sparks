-- «Звёзды» переходят в ведение смены: финалисты и победитель отмечаются на
-- странице ведения, как итоги реалити, и пересчёт пишет stars_* сам.
--
-- До этой миграции звёзды ведущейся смены вводились ручной сеткой прямо в
-- achievements. Теперь stars_* — ключи ведения, и первый же пересчёт снёс бы
-- такие записи, не найдя их в shift_award. Переносим их в сырые факты.
-- Финалиста-победителя не переносим: финал ему проставит каскад.
INSERT INTO shift_award (shift_id, kind, day_number, user_id)
SELECT a.shift_id, s.name, 0, a.user_id
FROM achievements a
JOIN settings s ON s.id = a.setting_id
JOIN shift_info si ON si.shift_id = a.shift_id
WHERE si.live_mode
  AND a.amount > 0
  AND (
    s.name = 'stars_winner'
    OR (
      s.name = 'stars_finalist'
      AND NOT EXISTS (
        SELECT 1
        FROM achievements w
        JOIN settings ws ON ws.id = w.setting_id
        WHERE ws.name = 'stars_winner'
          AND w.amount > 0
          AND w.shift_id = a.shift_id
          AND w.user_id = a.user_id
      )
    )
  )
ON CONFLICT DO NOTHING;
