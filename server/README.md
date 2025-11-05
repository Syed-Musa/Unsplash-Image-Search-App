# Image Search App — Server

This is a minimal Express + MongoDB backend for the Image Search App. It provides:

- User authentication (signup/login/logout) using JWT
- A protected endpoint POST /api/search to persist search terms with user id and timestamp

Setup

1. Add `.env` and fill in values (MongoDB Atlas connection string and JWT secret).
2. Install dependencies:

```bash
cd server
npm install
```

3. Start in development (requires nodemon):

```bash
npm run dev
```

API

- POST /api/auth/signup { name, email, password } -> { token, user }
- POST /api/auth/login { email, password } -> { token, user }
- POST /api/auth/logout (requires Authorization header) -> { ok: true }
- POST /api/search { term } (requires Authorization header) -> saves a Search doc { user, term, createdAt }


