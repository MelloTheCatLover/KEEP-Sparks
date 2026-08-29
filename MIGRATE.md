# Переезд на другой VPS без потери данных

Что переносим: базу (docker-том `db-data`), `.env` и домен. Код уже в GitHub,
образы собираются на месте, TLS выпускается заново после смены A-записи.

**Порядок такой:** сначала полностью поднимаем новый сервер и проверяем его по
IP, и только потом трогаем DNS. Старый не гасим, пока записи не разъедутся.

---

## 0. За сутки до переезда

Снизить TTL A-записи домена до 60–300 секунд. Тогда после переключения мир
увидит новый IP за минуты, а не за сутки.

## 1. Снять дамп со старого сервера

```bash
cd ~/keep-sparks
set -a; source .env; set +a
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges | gzip > sparks-final.sql.gz
```

Скачать к себе (и сохранить `.env` — в нём `JWT_SECRET`, пароль БД, домен):

```bash
scp <user>@<старый-ip>:~/keep-sparks/sparks-final.sql.gz .
scp <user>@<старый-ip>:~/keep-sparks/.env  ./env-prod-backup
```

### Если в сервер не зайти

- **Снапшот диска в панели провайдера** → развернуть новый инстанс из снапшота.
  Это полный клон: переносить нечего, только поменять A-запись (и, если IP
  зашит в конфигах, поправить его).
- **Rescue mode** → примонтировать диск и забрать любое из:
  - `~/keep-sparks/backups/sparks-<дата>.sql.gz` — ежедневный дамп, хранится 14 дней;
  - каталог тома `/var/lib/docker/volumes/<стек>_db-data/_data` — это PGDATA целиком;
    переносится как есть, но только на ту же мажорную версию Postgres (у нас 18).
- **Ничего не доступно** — остаётся `old_data/prod-seed.sql.gz` (состояние на день
  деплоя). Всё, что вводили после, потеряно.

## 2. Подготовить новый сервер

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER" && newgrp docker

git clone https://github.com/MelloTheCatLover/KEEP-Sparks.git keep-sparks
cd keep-sparks
```

Положить рядом `.env` — **тот же самый, что на старом сервере**:

- `JWT_SECRET` обязан совпасть, иначе все выданные токены (дети, админ, судьи
  фестиваля) станут недействительны и всем придётся входить заново;
- `DB_NAME` / `DB_USER` / `DB_PASSWORD` — как были, иначе дамп ляжет в чужие имена;
- `DOMAIN` и `CORS_ORIGIN=https://<домен>` — те же.

Порты 80 и 443 должны быть открыты в файрволе провайдера.

## 3. Залить базу

```bash
set -a; source .env; set +a
docker compose up -d db
sleep 10                                  # ждём healthcheck
gunzip -c sparks-final.sql.gz | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"
```

Проверка, что данные на месте:

```bash
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c \
  "select (select count(*) from user_main) as users,
          (select count(*) from achievements) as achievements,
          (select count(*) from shift_info) as shifts,
          (select count(*) from festival_participant) as festival_members,
          (select max(name) from _migrations) as last_migration;"
```

`last_migration` должен быть свежим (`034_festival_timing.sql` или новее). Если
дамп старее кода — ничего страшного: контейнер `server` при старте сам догонит
миграции, они идемпотентны.

## 4. Поднять остальное

```bash
docker compose up -d --build server web db-backup
docker compose logs -f server | head -40    # ждём "server is running"
```

## 5. Проверить по IP, до смены DNS

```bash
curl -s http://<новый-ip>/api/state
curl -s http://<новый-ip>/api/festival/board/none   # ждём {"error":"Гонка не найдена"}
```

Открыть `http://<новый-ip>` в браузере: вход админом, рейтинг, смены, фестиваль.
Сертификата на этом шаге ещё нет — это нормально, Caddy выпустит его, когда домен
начнёт указывать сюда.

## 6. Переключить домен

Поменять A-запись (и AAAA, если есть) на новый IP. Дальше:

```bash
docker compose logs -f web        # видно, как берётся сертификат Let's Encrypt
curl -sI https://<домен> | head -1
```

Старый сервер держать включённым сутки — на случай кэшированного DNS у клиентов.

## 7. После переезда

- Проверить, что `db-backup` пишет: `ls -l backups/` через сутки.
- Снять со старого сервера последний дамп ещё раз, если на нём успели поработать
  после шага 1, и накатить разницу — либо, что проще, повторить шаги 1 и 3 в
  короткое окно простоя.
- Вернуть TTL домена обратно (3600 и больше).

## Что переезд НЕ переносит

- Сертификаты TLS — выпускаются заново автоматически.
- Тома `caddy-data` / `caddy-config` — переносить не нужно.
- Локальные правки на старом сервере, если их не коммитили в GitHub. Проверить:
  `git status` на старой машине перед переездом.
