# Deployment Guide — GitHub + Vercel + Railway

## Architecture

| Layer | Host | Folder |
|-------|------|--------|
| Frontend | **Vercel** | `client/` |
| Backend API | **Railway** | `server/` |
| Database | **MongoDB Atlas** | DB name: `Suretrack-eBMR` |

## 1. MongoDB Atlas connection string

In Atlas → Cluster0 → Connect → Drivers, copy URI like:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/Suretrack-eBMR?retryWrites=true&w=majority
```

Also allow Railway/Vercel IPs (or `0.0.0.0/0` for Network Access during demo).

## 2. Railway (backend) env vars

```
MONGODB_URI=<atlas uri above>
JWT_ACCESS_SECRET=<long random string>
JWT_REFRESH_SECRET=<long random string>
CLIENT_ORIGIN=https://YOUR_VERCEL_URL
SEED_ADMIN_EMAIL=admin@suretech.local
SEED_ADMIN_PASSWORD=Admin@12345
HOST=0.0.0.0
```

Root directory: `server`  
After deploy: run seed once (`npm run seed` in Railway shell or one-off).

## 3. Vercel (frontend) env vars

```
VITE_API_URL=https://YOUR_RAILWAY_API_URL
```

Root directory: `client`  
Framework: Vite

## 4. Order of operations

1. Push to GitHub  
2. Deploy Railway → get API URL  
3. Deploy Vercel with `VITE_API_URL`  
4. Set Railway `CLIENT_ORIGIN` to Vercel URL  
5. Seed Atlas database  
