# Переезд на другой VPS

Порядок — в два захода. Сначала новый сервер поднимается **с пустой базой** и
начинает работать, потом, когда старая машина станет доступна, в него заливается
дамп. Так переезд не ждёт починки старого сервера.

- **Часть 1** — поднять стек с нуля, без данных. Можно делать прямо сейчас.
- **Часть 2** — залить дамп поверх, когда он появится.

Код уже в GitHub, образы собираются на месте, TLS выпускается сам после смены
A-записи. База живёт только в docker-томе `db-data` — в git её нет.

---

# Часть 1. Новый сервер с пустой базой

## 1.1 Докер и код

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER" && newgrp docker

git clone https://github.com/MelloTheCatLover/KEEP-Sparks.git keep-sparks
cd keep-sparks
```

## 1.2 Конфиг

```bash
cp .env.prod.example .env
openssl rand -base64 32   # для DB_PASSWORD
openssl rand -base64 32   # для JWT_SECRET
nano .env
```

Заполнить: `DOMAIN=<домен>`, `CORS_ORIGIN=https://<домен>`, `DB_PASSWORD`,
`JWT_SECRET`.

Про значения, когда старый `.env` недоступен:

- `DB_NAME` / `DB_USER` / `DB_PASSWORD` — **можно любые новые**. Дамп снимается с
  `--no-owner --no-privileges`, поэтому ляжет в базу под другим именем и
  пользователем без правок.
- `JWT_SECRET` — **если старый известен, ставьте старый**. Новый секрет обнуляет
  все выданные токены: дети, админ и судьи фестиваля просто войдут заново по
  своим логинам. Данные от этого не страдают.

Порты 80 и 443 должны быть открыты в файрволе провайдера.

## 1.3 Поднять стек

```bash
docker compose up -d --build
docker compose logs -f server | head -40    # ждём "server is running"
```

Контейнер `server` при старте сам прогоняет миграции и создаёт пустую схему —
отдельной команды не нужно.

## 1.4 Завести админа

Пользователей ещё нет, зайти нечем:

```bash
docker compose exec server node dist/scripts/create-admin.js <логин> <пароль>
```

Скрипт идемпотентный: существующий логин он повышает до админа и переустанавливает
пароль. После заливки дампа (часть 2) вернутся старые аккаунты, включая `mello`.

## 1.5 Проверить по IP, до смены DNS

```bash
curl -s http://<новый-ip>/api/state
curl -s http://<новый-ip>/api/festival/board/none   # ждём {"error":"Гонка не найдена"}
```

Открыть `http://<новый-ip>` в браузере и войти заведённым админом. Сертификата
пока нет — это нормально, он выпишется, когда домен начнёт указывать сюда.

## 1.6 Фестиваль, если он нужен раньше данных

```bash
docker compose exec server node dist/scripts/seed-festival.js festival --csv /tmp/pins.csv
docker compose cp server:/tmp/pins.csv ./pins.csv
```

Гонка, 22 номера с судьями и коды — экран показа на `/festival/screen/festival`,
судьи на `/festival/judge`. Фестиваль ни с чем в искрах не связан, поэтому пустая
база ему не мешает.

**Важно:** если фестиваль пройдёт до заливки дампа, его результаты надо будет
сохранить отдельно — см. 2.2, там это учтено.

## 1.7 Переключить домен

За сутки (или хотя бы за час) до этого снизить TTL A-записи до 60–300 секунд.
Затем поменять A-запись (и AAAA, если есть) на новый IP.

```bash
docker compose logs -f web        # видно, как берётся сертификат Let's Encrypt
curl -sI https://<домен> | head -1
```

Старый сервер, когда оживёт, держать включённым сутки — на случай кэшированного
DNS у клиентов.

---

# Часть 2. Залить дамп, когда старый сервер вернётся

## 2.1 Снять дамп со старой машины

```bash
cd ~/keep-sparks
set -a; source .env; set +a
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges | gzip > sparks-final.sql.gz
```

Переложить на новый сервер:

```bash
scp <user>@<старый-ip>:~/keep-sparks/sparks-final.sql.gz .
scp sparks-final.sql.gz <user>@<новый-ip>:~/keep-sparks/
```

### Если в старый сервер по-прежнему не зайти

- **Снапшот диска в панели провайдера** — развернуть из него временный инстанс,
  зайти туда и снять дамп обычным способом.
- **Rescue mode** — примонтировать диск и забрать:
  - `~/keep-sparks/backups/sparks-<дата>.sql.gz` — ежедневный `pg_dump`, хранится 14 дней;
  - либо каталог тома `/var/lib/docker/volumes/<стек>_db-data/_data` — это PGDATA
    целиком, переносится как есть на ту же мажорную версию Postgres (у нас 18).
- **Ничего не доступно** — остаётся `old_data/prod-seed.sql.gz` (состояние на день
  первого деплоя). Всё, что вводили после, потеряно.

## 2.2 Сохранить то, что уже наработано на новом сервере

Заливка дампа перетирает базу целиком. Если на новом сервере успели провести
фестиваль или завести детей — сначала выгрузить это отдельно.

```bash
cd ~/keep-sparks
set -a; source .env; set +a

# фестиваль (таблицы и их последовательности попадают по маске)
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --data-only --table 'festival_*' > festival-data.sql
```

Если заводили детей или смены — их так не вытащить, они переплетены с остальными
таблицами. Тогда правильнее наоборот: сначала залить дамп (2.3), а вводить
руками уже после.

## 2.3 Залить дамп

```bash
docker compose stop server     # чтобы никто не писал в базу во время заливки

docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

gunzip -c sparks-final.sql.gz | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"

docker compose start server    # на старте догонит миграции, которых нет в дампе
```

## 2.4 Вернуть фестиваль, если сохраняли

```bash
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < festival-data.sql
```

## 2.5 Проверка

```bash
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c \
  "select (select count(*) from user_main) as users,
          (select count(*) from achievements) as achievements,
          (select count(*) from shift_info) as shifts,
          (select count(*) from festival_participant) as festival_members,
          (select max(name) from _migrations) as last_migration;"
```

`last_migration` должен быть `034_festival_timing.sql` или новее. Если дамп
старее кода — ничего страшного: миграции идемпотентны, `server` их догонит сам,
это видно в его логе при старте.

Дальше — войти админом (после заливки действуют **старые** логины и пароли,
включая `mello`), проверить рейтинг, смены и фестиваль.

## 2.6 После

- Убедиться, что `db-backup` пишет: `ls -l backups/` через сутки.
- Вернуть TTL домена обратно (3600 и больше).
- Если на старом сервере успели поработать после снятия дампа — повторить 2.1–2.3
  в короткое окно простоя.

---

## Что переезд не переносит

- Сертификаты TLS — выпускаются заново автоматически.
- Тома `caddy-data` / `caddy-config` — переносить не нужно.
- Правки, сделанные на старом сервере и не закоммиченные в GitHub. Когда машина
  оживёт, проверить там `git status`.
