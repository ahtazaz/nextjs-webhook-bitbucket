Create systemd service: /etc/systemd/system/webhook.service
```
[Unit]
Description=Webhook Deploy Server
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/deploy-webhook/server.js
WorkingDirectory=/opt/deploy-webhook
Restart=always
User=your_user
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

```
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable webhook
sudo systemctl start webhook
sudo systemctl status webhook