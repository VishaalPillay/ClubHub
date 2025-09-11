# database.py
from sqlmodel import SQLModel, create_engine

# Paste your Render PostgreSQL URL here
DATABASE_URL = "postgresql://clubhub_db_c2ub_user:sdp5uXKyPuDQZiFC3H7RttZHqfA58gNF@dpg-d319nojuibrs73acdkag-a.singapore-postgres.render.com/clubhub_db_c2ub"
# Create the database engine
engine = create_engine(DATABASE_URL.replace("postgres://", "postgresql://"))

def create_db_and_tables():
    # This function creates all the tables defined in your models
    print("Creating database and tables...")
    SQLModel.metadata.create_all(engine)
    print("Database and tables created.")