# Деплой

Прод-стек: **Caddy** (раздаёт SPA + проксирует `/api`, авто-TLS) → **Node** API →
**Postgres** (закрыт в сети) + ежедневный `pg_dump`. Всё в Docker Compose.

## Что нужно
- VPS (Ubuntu 24.04+), 1 ГБ RAM хватит.
- Домен с A-записью (и AAAA, если есть IPv6) на IP сервера.
- Открытые порты `80` и `443`.

## Первый деплой

```bash
# 1. Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER" && newgrp docker

# 2. Код (после того как запушите репозиторий на remote и склонируете сюда)
git clone <repo-url> keep-sparks && cd keep-sparks

# 3. Конфиг
cp .env.prod.example .env
#   DOMAIN=ваш-домен, CORS_ORIGIN=https://ваш-домен
#   DB_PASSWORD и JWT_SECRET — сгенерировать:  openssl rand -base64 32
nano .env

# 4. Поднять БД первой и залить данные (дамп лежит вне git — скопируйте его на сервер)
docker compose up -d db
#   ждём готовности БД (пара секунд), затем восстановление:
gunzip -c prod-seed.sql.gz | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"

# 5. Собрать и поднять остальное
docker compose up -d --build server web db-backup
```

Caddy сам получит TLS-сертификат для `$DOMAIN`. Проверка: открыть `https://<домен>`.
Логин админа — тот же, что в перенесённой БД (`mello`).

> `DB_USER`/`DB_PASSWORD`/`DB_NAME` берутся из `.env`; чтобы шаг 4 подставил их в
> shell, сначала `set -a; source .env; set +a`.

## Перенос текущих данных

Дамп локальной БД уже сделан: `old_data/prod-seed.sql.gz` (вне git — содержит
ПДн). Скопируйте его на сервер рядом с `docker-compose.yml` как `prod-seed.sql.gz`
и выполните шаг 4. Дамп снят с `--no-owner --no-privileges`, поэтому ложится в
прод-БД под её пользователем без правки владельцев. Схема (`_migrations`) внутри
дампа — миграции при старте сервера увидят применённые и не тронут их.

Пересоздать дамп при необходимости:
```bash
pg_dump -h /var/run/postgresql -U mello -d sparks --no-owner --no-privileges \
  | gzip > old_data/prod-seed.sql.gz
```

## Обновление (новый код)
```bash
git pull
docker compose up -d --build server web   # db и db-backup не трогаем
```
Миграции применяются автоматически при старте контейнера `server`.

## Бэкапы
Сервис `db-backup` кладёт ежедневный `pg_dump` в `./backups/` и хранит 14 дней.
Восстановление: `gunzip -c backups/<файл>.sql.gz | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"`.
Рекомендуется дополнительно синкать `./backups` на внешнее хранилище.

## Примечания
- Postgres портов наружу не публикует — доступен только сервисам стека.
- `.env`, `old_data/`, `backups/` — вне git (см. `.gitignore`).
- Node-образы — `node:22-alpine`; БД — `postgres:18-alpine` (совпадает с локальной 18.x).
- Локально образы не собирались (в среде разработки не было Docker) — первая
  сборка произойдёт на сервере.
