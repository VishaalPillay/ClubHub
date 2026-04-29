# routes/tasks.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db_connection
from schemas import TaskCreate, TaskPublic, TaskUpdate
from auth import require_role, get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/", response_model=TaskPublic, status_code=status.HTTP_201_CREATED)
def create_task(
    task_create: TaskCreate,
    current_user: dict = Depends(require_role("lead")),
    connection = Depends(get_db_connection)
):
    """
    Create a new task. Only accessible by a lead.
    """
    cursor = connection.cursor(dictionary=True)
    
    # Security Check: Ensure the assignee is a member of the lead's domain
    cursor.execute("SELECT domain_id FROM users WHERE id = %s", (task_create.assignee_id,))
    assignee = cursor.fetchone()
    
    if not assignee or assignee['domain_id'] != current_user['domain_id']:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assignee must be a member of your domain.",
        )

    # Insert task
    insert_query = """
    INSERT INTO tasks (title, description, status, domain_id, assignee_id, creator_id)
    VALUES (%s, %s, %s, %s, %s, %s)
    """
    cursor.execute(insert_query, (
        task_create.title,
        task_create.description,
        'todo',
        current_user['domain_id'],
        task_create.assignee_id,
        current_user['id']
    ))
    
    task_id = cursor.lastrowid
    connection.commit()
    
    # Fetch result
    cursor.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
    new_task = cursor.fetchone()
    cursor.close()
    
    return new_task

@router.get("/my", response_model=List[TaskPublic])
def get_my_tasks(
    current_user: dict = Depends(require_role("member")),
    connection = Depends(get_db_connection)
):
    """
    Get all tasks assigned to the currently logged-in member.
    """
    cursor = connection.cursor(dictionary=True)
    cursor.execute("SELECT * FROM tasks WHERE assignee_id = %s", (current_user['id'],))
    tasks = cursor.fetchall()
    cursor.close()
    
    return tasks

@router.patch("/{task_id}/status", response_model=TaskPublic)
def update_task_status(
    task_id: int,
    task_update: TaskUpdate,
    current_user: dict = Depends(require_role("member")),
    connection = Depends(get_db_connection)
):
    """
    Update the status of a task. Only accessible by the member assigned to the task.
    """
    cursor = connection.cursor(dictionary=True)
    
    # Fetch task
    cursor.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
    task_to_update = cursor.fetchone()

    if not task_to_update:
        cursor.close()
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Security Check: Ensure the user is the assignee of the task
    if task_to_update['assignee_id'] != current_user['id']:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update tasks assigned to you.",
        )

    # Update status
    cursor.execute("UPDATE tasks SET status = %s WHERE id = %s", (task_update.status, task_id))
    connection.commit()
    
    # Fetch updated task
    cursor.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
    updated_task = cursor.fetchone()
    cursor.close()
    
    return updated_task