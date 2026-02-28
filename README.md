# BiteSpeed Identity Reconciliation Service

This is a Node.js + Express backend service built for the BiteSpeed Backend Task. The application exposes an identity reconciliation endpoint that evaluates incoming customer data (Emails and Phone numbers), accurately groups matching pieces of information into clustered identities (cross-device/cross-purchase), and designates a primary and secondary ranking based on when the customer first interacted.

## 🚀 Live Demo
The API is currently live and deployed via Render:
**Live URL:** `https://bitespeed-identity-gxph.onrender.com/api/identify`

---

## 🛠️ Stack Overview
- **Runtime:** Node.js
- **Framework:** Express.js (TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma v7 (With explicit `@prisma/adapter-pg` implementation bridging connection pools)
- **Testing:** Jest + Supertest

---

## 💻 Making a Request

**Method:** `POST`
**Endpoint:** `/api/identify`
**Headers:** `Content-Type: application/json`

### Example Test Case in Postman

You can easily verify the endpoint's clustering behavior logic. 
Open Postman (or use cURL) and execute the following sequential chain of requests:

#### Request 1: Creating the Primary Node
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```
**Response 1:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

#### Request 2: Updating the Same User (Creates a Secondary Node)
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```
**Response 2:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```
*Notice how the cluster seamlessly expanded our `123456` user to retain the new email as a secondary credential!*

---

## 🧪 Running Locally

Should you want to test the behavior locally, follow these steps:

### 1. Installation
```bash
git clone https://github.com/Anoint2612/BiteSpeed_Identity.git
cd BiteSpeed_Identity
npm install
```

### 2. Environment Configuration
Create a `.env` file at the root of the project with your valid PostgreSQL connection:
```env
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/identity"
```

### 3. Database Initialization
This project uses Prisma v7. Generate the models and sync the schema:
```bash
npx prisma generate
npx prisma db push
```

### 4. Running the Server
**Development Mode:**
```bash
npm run dev
```
**Production Build:**
```bash
npm run build
npm start
```

---

## ⚙️ Automated Test Coverage
This service natively supports completely isolated and idempotent integration tests.

Run the test suite spanning null permutations, clustering scenarios, and idempotency checks:
```bash
npm run test
```

### Measured Constraints Successfully Applied:
✅ Handled overlapping Primary Demotion (Merge collisions)
✅ Implemented complete SQL Transactionality avoiding race condition duplicates
✅ Verified robust payload data type fallbacks (Null constraints bypass)
✅ Native insertion-order integrity ensuring oldest components always lead the arrays
