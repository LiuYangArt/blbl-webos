# Playurl Relay

## 用 Docker Compose 启动

1. 复制配置模板：

```bash
cp relay/.env.example relay/.env.local
```

2. 默认可以不填 `RELAY_ACCESS_TOKEN`。如果你后面确实想加一层轻量鉴权，再自己填随机字符串。

3. 启动服务：

```bash
docker compose --env-file relay/.env.local -f relay/compose.yaml up -d
```

4. 查看状态：

```bash
docker compose --env-file relay/.env.local -f relay/compose.yaml ps
docker compose --env-file relay/.env.local -f relay/compose.yaml logs -f
```

当前 compose 项目名和容器名都会显示为 `bilibili-relay`，方便和别的 relay / bot / 代理服务区分。

现在 relay 除了帮 TV 代拿 `playurl` 之外，也会自动代理高码率媒体分片 / MP4 请求。
这意味着 TV 端只要填好同一个 relay IP 和端口，播放器在需要时就会自动走 `relay /media` 去拉 1080 DASH / HEVC 资源，不需要再额外配置第二个媒体代理地址。

## 自动启动

compose 里已经设置：

```yaml
restart: unless-stopped
```

只要 Docker Desktop 会在系统启动后自动恢复，这个 relay 容器也会跟着自动启动。

## TV 端填写

- 服务器 IP：填写这台 Mac mini 的局域网 IP
- 端口：默认 `19091`
- TV 端不需要输入 `http://`
- Token：默认不需要；只有你自己显式配置了 `RELAY_ACCESS_TOKEN` 时才需要同步填写
- TV 端地址会自动保存，不需要手动点保存按钮

如果是在这次功能接入前就已经登录过，需要重新扫码一次，TV 端才会拿到可用于 relay 建立会话的登录完成信息。
