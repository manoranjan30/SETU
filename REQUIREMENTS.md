
# SETU Application Requirements

To successfully run and develop the SETU application, ensure your environment meets the following requirements.

## 1. System Requirements

- **Operating System:** Windows 10/11, macOS, or Linux
- **RAM:** Minimum 8GB (16GB Recommended)
- **Disk Space:** at least 10GB free space

## 2. Software Dependencies

### Core
- **Node.js:** v18.0.0 or higher (LTS recommended)
- **NPM:** v9.0.0 or higher (Installed with Node.js)
- **Git:** Latest version

### Database
- **PostgreSQL:** v15 or higher
- **Docker & Docker Compose:** Optional but recommended for easy database setup.

### Optional
- **Python:** v3.8+ (for running utility scripts if any)
- **Visual Studio Code:** Recommended IDE

## 3. Environment Configuration

You must configure the `.env` files for both backend and frontend.

### Backend (`backend/.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=setu_db
JWT_SECRET=your_jwt_secret
PORT=3000
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3000
```

## 4. Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone <repo-url>
    cd SETU
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    npm install
    npm run start:dev
    ```

3.  **Frontend Setup:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

4.  **Database Setup:**
    Ensure PostgreSQL is running and the database `setu_db` exists.
    Or use Docker: `docker-compose up -d`
