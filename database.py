import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
# Create the database engine
engine = create_engine(DATABASE_URL.replace("postgres://", "postgresql://"))

def create_db_and_tables():
    # This function creates all the tables defined in your models
    print("Creating database and tables...")
    SQLModel.metadata.create_all(engine)
    print("Database and tables created.")