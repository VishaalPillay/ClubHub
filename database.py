import os
import mysql.connector
import mysql.connector.pooling
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "#Superce11")
DB_NAME = os.getenv("DB_NAME", "clubhub")

# --- Initialize Database (Ensure it exists) ---
try:
    temp_conn = mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = temp_conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
    cursor.close()
    temp_conn.close()
except Error as e:
    print(f"Critical: Could not ensure database '{DB_NAME}' exists: {e}")

# --- Connection Pool ---
db_config = {
    "host": DB_HOST,
    "user": DB_USER,
    "password": DB_PASSWORD,
    "database": DB_NAME,
}

try:
    db_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="clubhub_pool",
        pool_size=5,
        **db_config
    )
except Error as e:
    print(f"Critical: Failed to create connection pool: {e}")
    db_pool = None

def get_db_connection():
    """
    FastAPI dependency that yields a connection from the pool.
    Closes the connection automatically after the request.
    """
    if not db_pool:
        raise Exception("Database connection pool is not initialized.")
    
    connection = None
    try:
        connection = db_pool.get_connection()
        yield connection
    finally:
        if connection and connection.is_connected():
            connection.close()

def create_db_and_tables():
    """Initializes the schema using a connection from the pool."""
    if not db_pool:
        return

    connection = None
    try:
        connection = db_pool.get_connection()
        cursor = connection.cursor()
        
        # Create Domains table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS domains (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            INDEX idx_domain_name (name)
        ) ENGINE=InnoDB;
        """)
        
        # Create Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            domain_id INT,
            INDEX idx_user_email (email),
            CONSTRAINT fk_user_domain FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
        ) ENGINE=InnoDB;
        """)
        
        # Create Tasks table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'todo',
            domain_id INT NOT NULL,
            assignee_id INT NOT NULL,
            creator_id INT NOT NULL,
            CONSTRAINT fk_task_domain FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
            CONSTRAINT fk_task_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_task_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
        """)
        
        connection.commit()
        cursor.close()
        print("MySQL database and tables initialized successfully using connection pool.")
    except Error as e:
        print(f"Error during schema creation: {e}")
    finally:
        if connection and connection.is_connected():
            connection.close()