import api, { clubHeaders } from "@/lib/api/client";
import type { Task, TaskStatus } from "@/types/api";

export async function listTasks(clubId: number): Promise<Task[]> {
  const res = await api.get<Task[]>(`/clubs/${clubId}/tasks`, { headers: clubHeaders(clubId) });
  return res.data;
}

export async function createTask(
  clubId: number,
  body: {
    domain_id: number;
    title: string;
    description: string | null;
    due_date: string | null;
    assignee_ids: number[];
  }
): Promise<Task> {
  const res = await api.post<Task>(`/clubs/${clubId}/tasks`, body, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function updateTask(
  clubId: number,
  taskId: number,
  changes: Partial<{
    title: string;
    description: string | null;
    due_date: string | null;
    status: TaskStatus;
  }>
): Promise<Task> {
  const res = await api.put<Task>(`/clubs/${clubId}/tasks/${taskId}`, changes, {
    headers: clubHeaders(clubId),
  });
  return res.data;
}

export async function deleteTask(clubId: number, taskId: number): Promise<void> {
  await api.delete(`/clubs/${clubId}/tasks/${taskId}`, { headers: clubHeaders(clubId) });
}

export async function assignTask(
  clubId: number,
  taskId: number,
  assigneeIds: number[]
): Promise<Task> {
  const res = await api.post<Task>(
    `/clubs/${clubId}/tasks/${taskId}/assign`,
    { assignee_ids: assigneeIds },
    { headers: clubHeaders(clubId) }
  );
  return res.data;
}
