Create systemd service: /etc/systemd/system/webhook.service
```
[Unit]
Description=Webhook Deploy Server
After=network.target

[Service]
ExecStart=/usr/bin/node /var/www/nextjs-webhook-bitbucket/index.js
WorkingDirectory=/var/www/nextjs-webhook-bitbucket
Restart=always
RestartSec=10
User=root
Environment=NODE_ENV=production
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=webhook-server

[Install]
WantedBy=multi-user.target


```
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable webhook
sudo systemctl start webhook
sudo systemctl status webhook