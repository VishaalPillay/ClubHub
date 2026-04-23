# ClubHub API

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-05998b?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql&logoColor=white)

## Project Description

ClubHub is a backend application designed to streamline the management of student clubs or small organizations. It features a robust, hierarchical Role-Based Access Control (RBAC) system with three distinct roles: President, Lead, and Member. The API allows for the creation of organizational domains (e.g., Technical, Creative), task assignment, and progress tracking, all governed by strict, role-specific permissions.

This project was developed as a take-home assessment to demonstrate proficiency in modern backend development practices, including database modeling, secure JWT authentication, role-based authorization, and clean API design.

## Key Features

- **Secure JWT Authentication**: Stateless and secure user authentication using JSON Web Tokens (JWT) with password hashing via `bcrypt`.
- **Role-Based Access Control (RBAC)**: A sophisticated permission system ensures users can only access endpoints appropriate for their role (President, Lead, Member), implemented via reusable dependencies.
- **CRUD Operations for Tasks**: Full Create, Read, and Update functionality for tasks, demonstrating the core requirement of the assignment.
- **Database Modeling**: A well-defined relational schema using PostgreSQL and SQLModel to manage users, domains, and tasks with clear, unambiguous relationships.
- **Clean Architecture**: The project follows a modular structure, separating concerns into different files for routing, database models, API schemas, and authentication logic.

## Tech Stack

- **Framework**: FastAPI
- **Database**: MySQL
- **ORM**: SQLModel (built on Pydantic and SQLAlchemy)
- **Server**: Uvicorn
- **Authentication**: Passlib with Bcrypt for hashing, Python-JOSE for JWT.
- **Validation**: Pydantic for data validation and serialization.

## Setup and Installation

### Prerequisites

- Python 3.10+
- A running PostgreSQL instance (cloud-hosted on a platform like Render is recommended).

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/ClubHub.git](https://github.com/your-username/ClubHub.git)
cd ClubHub
````

### 2\. Create and Activate a Virtual Environment

```bash
# For Windows
python -m venv venv
venv\Scripts\activate
```

### 3\. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4\. Configure Environment Variables

Create a file named `.env` in the root of the project. This file is listed in `.gitignore` and will not be committed to version control.

```env
DATABASE_URL="your_postgresql_connection_url_here"
JWT_SECRET_KEY="your_super_secret_32_character_hex_key_here"
```

### 5\. Running the Application

```bash
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
Interactive documentation (Swagger UI) is automatically generated and available at `http://127.0.0.1:8000/docs`.

## API Documentation

### Authentication & Users

| Method | Endpoint          | Permissions   | Description                                    |
|--------|-------------------|---------------|------------------------------------------------|
| `POST` | `/users/register` | Public        | Registers a new user (President, Lead, or Member).   |
| `POST` | `/token`          | Public        | Authenticates a user and returns a JWT token.  |
| `GET`  | `/users/me`       | Authenticated | Retrieves the profile of the logged-in user.   |

### Domains

| Method | Endpoint  | Permissions   | Description                         |
|--------|-----------|---------------|-------------------------------------|
| `POST` | `/domains`| President     | Creates a new domain.              |
| `GET`  | `/domains`| Authenticated | Retrieves a list of all domains.    |

### Tasks

| Method  | Endpoint                  | Permissions     | Description                                     |
|---------|---------------------------|-----------------|-------------------------------------------------|
| `POST`  | `/tasks`                  | Lead            | Creates a new task for a member in their domain.|
| `GET`   | `/tasks/my`               | Member          | Retrieves all tasks assigned to the member.     |
| `PATCH` | `/tasks/{task_id}/status` | Assigned Member | Updates the status of an assigned task.         |

```
```
