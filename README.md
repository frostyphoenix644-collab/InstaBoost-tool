# Xinv4sionx Marketplace — Full Stack (Node + Express)

**Features**
- Buyer & Seller accounts
- Airi mini-chat assistant (floating, everywhere except login/signup)
- Two themes: Light & Dark (toggle)
- Seller availability (Online / Busy / Offline + expected return time)
- Product Manager (upload up to 2 images)
- Hotlist (available items near you)
- JSON database (no external DB needed)
- Clean, professional structure
- Ideal for VPS / Railway / Render / Pterodactyl / Localhost

**Run**
```bash
npm install
npm start
# open http://localhost:2173/
```

**Env**
- PORT defaults to 2173
- Change in `backend/server.js` if needed

**Folders**
```
frontend/         # pages, styles, scripts, assets
backend/          # server, ai logic, upload handling, JSON db
uploads/          # runtime image uploads (created automatically)
package.json
README.md
```

**Note**
- This is a prototype-grade app using JSON file storage for simplicity.
- Move to SQL for production.