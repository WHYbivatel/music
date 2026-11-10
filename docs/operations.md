# Запуск и восстановление music.esl.kz

Интерфейс: PM2 `music.esl.kz`, порт `127.0.0.1:3220`. API, worker и dispatcher слушают только localhost. Nginx этого сайта проксирует сайт на 3220; `/v1` уходит в Next.js и оттуда на `127.0.0.1:3221`.

## Первый запуск

```sh
cd /var/www/music.esl.kz
npm ci
npm run build
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
```

Секреты лежат в `/var/www/music.esl.kz/.env`. Пример имён переменных — `.env.example`.

Первый администратор, пароль не попадает в историю команд:

```sh
cd /var/www/music.esl.kz/server
umask 077
.venv/bin/python -m app.cli create-admin --email admin@music.esl.kz --name Администратор --password-file /path/to/secret
```

Команда просит пароль с терминала, если `--password-file` не указан и есть TTY.

Процессы, только этого сайта:

```sh
pm2 start /var/www/music.esl.kz/server/.venv/bin/uvicorn --name music.esl.kz-api --cwd /var/www/music.esl.kz/server -- app.main:app --host 127.0.0.1 --port 3221
pm2 start /var/www/music.esl.kz/server/.venv/bin/python --name music.esl.kz-worker --cwd /var/www/music.esl.kz/server -- -m app.worker
pm2 start /var/www/music.esl.kz/server/.venv/bin/python --name music.esl.kz-dispatcher --cwd /var/www/music.esl.kz/server -- -m app.dispatcher
pm2 restart music.esl.kz
```

Не использовать `pm2 restart all`.

Проверки: `GET /v1/health/live` — процесс жив. `GET /v1/health/ready` — PostgreSQL и Redis отвечают. Неготовность зависимостей не равна остановке процесса.

## Что выключено

- `MUSIC_PROVIDER=mock` — демофайл, не модель. `ace` без URL и токена отвечает `error.provider` и не переключается на mock.
- `REAL_GENERATION_ENABLED=false` — купленные токены на генерацию не тратятся.
- `REAL_TRANSFERS_ENABLED=false` — реквизитов перевода нет. «Я оплатил» только переводит заявку в проверку.
- `SMTP_HOST` пуст — восстановление пароля честно возвращает `error.mail`.
- `SIGNUP_BONUS_TOKENS=0` — реальные 50 токенов новым аккаунтам не начисляются. Гость получает демотокены, пользователь — отдельные тестовые.
- `STORAGE_BACKEND=local` — файлы в `/var/lib/music.esl.kz/media`. Это каталог одного сайта, не общий диск и не S3. Пока процесс и каталог на одной машине; для нескольких серверов нужен bucket.

## Резервная копия

```sh
umask 077
mkdir -p /var/lib/music.esl.kz/backups
pg_dump -Fc -h 127.0.0.1 -U music_esl music_esl > /var/lib/music.esl.kz/backups/music_esl-$(date +%Y%m%d%H%M).dump
tar -C /var/lib/music.esl.kz -czf /var/lib/music.esl.kz/backups/media-$(date +%Y%m%d%H%M).tar.gz media
```

Откат файлов приложения не откатывает схему. Перед миграцией сохраняйте dump. Восстановление:

```sh
pg_restore -h 127.0.0.1 -U music_esl -d music_esl --clean --if-exists backup.dump
tar -C /var/lib/music.esl.kz -xzf media-backup.tar.gz
```

Предыдущую сборку Next.js перед заменой копировать в `/var/lib/music.esl.kz/rollback/`. Вернуть каталог `.next` и перезапустить только `music.esl.kz`.

## Очистка

Dispatcher раз в час удаляет просроченные заявки «ожидает оплаты», старые сброшенные сессии, файлы удалённых треков и файлы в каталоге без записи в базе старше суток. Потерянная задача в PostgreSQL остаётся: dispatcher снова кладёт её в Redis.

Логи JSON в stdout PM2. В них нет паролей, cookie и текста запроса. Есть `request_id` и при сбое обработки `job_id`.
