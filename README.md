# 🌶️ Spicy Spot — Campus Food Delivery

A full-stack campus/hostel food-ordering website using Node.js, Express and MongoDB.

## Menu
- Chicken Dum Biryani — ₹130
- Biryani Plain Rice — ₹120

## Customer flow
1. Customer opens Spicy Spot.
2. Selects food and adds it to cart.
3. Enters name, 10-digit phone number and room/classroom.
4. Confirms the order.
5. The order is saved in MongoDB.
6. A unique Order ID is displayed.
7. Customer can track the order using that Order ID.

Customer cancellation is not available. Only the admin can mark an order as Cancelled.

## Admin flow
- Open `/admin`.
- Sign in with the `ADMIN_KEY` configured by the owner.
- Today's active orders are shown automatically.
- The dashboard checks for new orders every 5 seconds and displays a new-order notification.
- Admin can change status: New → Accepted → Preparing → Out for Delivery → Delivered.
- Admin can also mark an order Cancelled.
- Previous-day orders remain stored in MongoDB and are available in History.

## Run locally
Open the project folder in VS Code terminal:

```bash
npm install
```

Create `.env` from `.env.example` and set your own values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/spicy_spot
ADMIN_KEY=CHANGE_THIS_TO_A_SECRET_PASSWORD
```

Start the server:

```bash
npm start
```

Open:
- Customer: `http://localhost:5000`
- Admin: `http://localhost:5000/admin`

Do not double-click `index.html`; the site needs the Node.js backend.

## Public phone access
For access without the laptop's Wi-Fi, deploy the project online. Recommended setup:

1. Push this folder to a GitHub repository.
2. Create a MongoDB Atlas database.
3. Deploy this repository as a Render Web Service.
4. Set these Render environment variables:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `ADMIN_KEY` = a strong private admin password
5. Render runs `npm install` and `npm start` automatically.
6. Your public address will be similar to `https://spicy-spot.onrender.com` if that service name is available.

Do not commit `.env` or real passwords to GitHub. The repository can be public, but the `MONGODB_URI` and `ADMIN_KEY` must remain secret.

## Health check
The server provides:

`/api/health`

It reports whether the Node.js server is running and whether MongoDB is connected.
