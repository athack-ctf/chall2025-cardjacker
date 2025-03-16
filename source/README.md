# Running This Challenge

Build
```
docker build -t athack-ctf/chall2025-cardjacker:latest .
```

Run
```
docker run -d --name cardjacker \
  --hostname cardjacker \
  -p 52043:2025 \
  athack-ctf/chall2025-cardjacker:latest
```
