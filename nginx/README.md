# nginx

`nginx.conf` — конфиг сайта для nginx хоста: `/api/` → backend (`127.0.0.1:8341`), остальное →
frontend (`127.0.0.1:8340`). Основной конфиг nginx не меняется — сайт подключается симлинками
`sites-available` → файл в репозитории, `sites-enabled` → `sites-available`. Править конфиг только
в репозитории: `deploy.sh` сбрасывает рабочую копию (`checkout -f`), правки на сервере через
симлинк потеряются.

## Установка

```bash
sudo ln -sfn /home/adxcel/adxcel-testtask/nginx/nginx.conf /etc/nginx/sites-available/adxcel.amwap.dev.conf
sudo ln -sfn /etc/nginx/sites-available/adxcel.amwap.dev.conf /etc/nginx/sites-enabled/adxcel.amwap.dev.conf
sudo nginx -t && sudo systemctl reload nginx
```

Каталог репозитория должен быть доступен на чтение пользователю nginx (`www-data`).

## SSL

Certbot ставится в режиме `certonly`: `--nginx` без него дописал бы SSL в файл репозитория через
симлинк, и следующий деплой это затёр бы.

1. Установить certbot с плагином nginx:

   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Выпустить сертификат (конфиг не меняется, автопродление настраивается):

   ```bash
   sudo certbot certonly --nginx -d adxcel.amwap.dev
   ```

3. В `nginx/nginx.conf` в репозитории добавить HTTPS: `listen 443 ssl;` / `listen [::]:443 ssl;`,
   `ssl_certificate /etc/letsencrypt/live/adxcel.amwap.dev/fullchain.pem;`,
   `ssl_certificate_key /etc/letsencrypt/live/adxcel.amwap.dev/privkey.pem;` и отдельный server на
   порту 80 с `return 301 https://$host$request_uri;`. Закоммитить в `live`, после деплоя —
   `sudo nginx -t && sudo systemctl reload nginx`.

4. Включить secure-cookie для refresh-токена:

   ```bash
   cd /home/adxcel/adxcel-testtask
   sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' backend/.env
   docker compose up -d --force-recreate backend
   ```

5. Проверить: `curl -I https://adxcel.amwap.dev/` и `sudo certbot renew --dry-run`.

## Обновление конфига

Симлинк указывает на файл в репозитории, поэтому `deploy.sh` обновляет конфиг вместе с кодом.
Перезагрузка nginx требует root — если `nginx/nginx.conf` изменился, деплой выведет:

```bash
sudo nginx -t && sudo systemctl reload nginx
```
