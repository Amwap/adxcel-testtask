# nginx

`nginx.conf` — конфиг сайта для nginx хоста: `/api/` → backend (`127.0.0.1:8341`), остальное →
frontend (`127.0.0.1:8340`). Основной конфиг nginx не меняется — сайт копируется в
`sites-enabled`. Файл в репозитории — без SSL, SSL certbot добавляет в копию на сервере.

## Установка

```bash
sudo cp /home/adxcel/adxcel-testtask/nginx/nginx.conf /etc/nginx/sites-enabled/adxcel.amwap.dev.conf
sudo nginx -t && sudo systemctl reload nginx
```

## SSL

1. Установить certbot с плагином nginx:

   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Выпустить сертификат. Certbot сам допишет в скопированный конфиг `listen 443 ssl`, пути к
   сертификату и редирект с HTTP, перезагрузит nginx и настроит автопродление:

   ```bash
   sudo certbot --nginx -d adxcel.amwap.dev --redirect
   ```

3. Включить secure-cookie для refresh-токена:

   ```bash
   cd /home/adxcel/adxcel-testtask
   sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' backend/.env
   docker compose up -d --force-recreate backend
   ```

4. Проверить: `curl -I https://adxcel.amwap.dev/` и `sudo certbot renew --dry-run`.

## Обновление конфига

`deploy.sh` копию не перезаписывает — если `nginx/nginx.conf` изменился, он выведет команды:

```bash
sudo cp /home/adxcel/adxcel-testtask/nginx/nginx.conf /etc/nginx/sites-enabled/adxcel.amwap.dev.conf
sudo certbot install --nginx --cert-name adxcel.amwap.dev --redirect   # вернуть SSL в новую копию
sudo nginx -t && sudo systemctl reload nginx
```
