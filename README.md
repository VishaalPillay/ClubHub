# ClubHub
A role-based REST API for club management built with Python, FastAPI, and PostgreSQL.

ClubHub is a backend application designed to streamline the management of student clubs or small organizations. It features a robust, hierarchical Role-Based Access Control (RBAC) system with three distinct roles: President, Lead, and Member. The API allows for the creation of organizational domains (e.g., Technical, Creative), task assignment, and progress tracking, all governed by strict, role-specific permissions.

Tech Stack: Python, FastAPI, SQLModel (SQLAlchemy + Pydantic), PostgreSQL, JWT for authentication.

-----

### How to Use This

1.  In the root of your `ClubHub` folder, you should have a file named `README.md`.
2.  Replace the entire content of that file with the text below.
3.  Commit this file to your Git repository.

-----

# ClubHub API

A role-based REST API for managing club activities, members, and tasks using a hierarchical role-based system. This backend is built with Python and FastAPI, designed for clarity, security, and scalability.

This project was developed as a take-home assessment to demonstrate proficiency in modern backend development practices, including database modeling, authentication, authorization, and clean API design.

## Key Features

  * **Secure User Registration:** Onboarding new users with secure password hashing using `bcrypt`.
  * **JWT Token-Based Authentication:** Stateless and secure authentication using JSON Web Tokens (JWT).
  * **Role-Based Access Control (RBAC):** A robust permission system with three distinct roles:
      * **President:** Full administrative access over the entire club.
      * **Lead:** Can manage tasks and members within their specific domain.
      * **Member:** Can view and update the status of their assigned tasks.
  * **Domain & Task Management:** Core functionality for creating organizational domains (e.g., Technical, Creative) and managing the lifecycle of tasks within them.

## Tech Stack

  * **Framework:** FastAPI
  * **Database:** PostgreSQL
  * **ORM:** SQLModel (built on Pydantic and SQLAlchemy)
  * **Server:** Uvicorn (ASGI Server)
  * **Authentication:** Passlib with Bcrypt for hashing, Python-JOSE for JWT.
  * **Validation:** Pydantic for data validation and serialization.

## Setup and Installation

### Prerequisites

  * Python 3.10+
  * PostgreSQL Database

### 1\. Clone the Repository

```bash
git clone https://github.com/your-username/ClubHub.git
cd ClubHub
```

### 2\. Create and Activate a Virtual Environment

```bash
# For Windows
python -m venv venv
venv\Scripts\activate

# For macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3\. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4\. Configure Environment Variables

This project uses a `.env` file for managing environment variables.

1.  Create a file named `.env` in the root of the project.
2.  Copy the contents of the example below and paste it into your new `.env` file.

**.env.example**

```env
# Replace with the connection URL from your PostgreSQL provider (e.g., Render)
DATABASE_URL="postgres://user:password@host:port/database"

# Generate a secure secret key by running: openssl rand -hex 32
JWT_SECRET_KEY="your_super_secret_32_character_hex_key_here"
```

3.  Update the values with your actual database URL and a unique secret key.

*(Note: The code would need to be updated to use a library like `python-dotenv` to read these values. For this project, we have hardcoded them, but this `.env` setup represents the professional standard.)*

### 5\. Running the Application

Once the setup is complete, you can run the application with Uvicorn:

```bash
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
Interactive documentation (Swagger UI) is available at `http://127.0.0.1:8000/docs`.

## API Documentation

### Authentication & Users

| Method | Endpoint             | Permissions      | Description                                          |
|--------|----------------------|------------------|------------------------------------------------------|
| `POST` | `/users/register`    | Public           | Registers a new user (President, Lead, or Member).   |
| `POST` | `/token`             | Public           | Authenticates a user and returns a JWT access token. |
| `GET`  | `/users/me`          | Authenticated    | Retrieves the profile of the currently logged-in user.|

**Example `POST /users/register` Request Body:**

```json
{
  "name": "Test Lead",
  "email": "lead@test.com",
  "password": "password123",
  "role": "lead",
  "domain_id": 1
}
```

## Project Structure

```
/ClubHub
|-- /routes
|   |-- users.py
|-- .gitignore
|-- auth.py
|-- database.py
|-- main.py
|-- models.py
|-- README.md
|-- requirements.txt
|-- schemas.py
```
