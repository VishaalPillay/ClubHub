"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import { listTasks, createTask, updateTask, deleteTask, assignTask, acceptTask } from "@/lib/api/tasks";
import { listMembers } from "@/lib/api/members";
import { listDomains } from "@/lib/api/domains";
import { isLeadPlus, roleAtLeast, canManage, isDomainScoped } from "@/lib/roles";
import type { Task, TaskStatus } from "@/types/api";

const DESC_TRUNCATE_LENGTH = 110;
const DESC_COLLAPSED_HEIGHT = 60; // ~3 lines at text-14/leading-snug, with a small buffer
// Mirrors backend ALLOWED_TASK_POINTS (app/modules/tasks/schemas.py) — a fixed scale
// rather than a free-form number, so task weight stays comparable across a club.
const TASK_POINTS_OPTIONS = [5, 10, 20, 50] as const;

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  return trimmed.trimEnd() + '…';
}

function EmptyColumn({ hint }: { hint: string }) {
  return (
    <div className="border-2 border-dashed border-hairline-tint bg-paper-quiet/50 flex flex-col items-center justify-center gap-1.5 py-12">
      <span className="font-mono text-11 uppercase tracking-widest text-[#9a927c]">Nothing running here</span>
      <span className="font-body text-12 text-[#b3ab96]">{hint}</span>
    </div>
  );
}

export default function TaskBoardPage() {
  const { clubId, currentRole, userId } = useClub();
  const queryClient = useQueryClient();

  const [assignModalTask, setAssignModalTask] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [acceptTaskId, setAcceptTaskId] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  // Tracks which tasks are currently rendering the FULL description text. On expand
  // this is set immediately, but on collapse it lags one animation frame behind
  // expandedTasks (see handleDescCollapseComplete) — swapping the text down to the
  // truncated preview in the same tick as the collapse would make Framer measure the
  // "from" height against the already-shrunk text, and the box would just pop shut
  // instead of animating.
  const [fullTextTasks, setFullTextTasks] = useState<Set<number>>(new Set());

  // New Task Modal state
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState<{ domain_id: number, title: string, desc: string, points: number, dueDate: string, assignedTo: number[] }>({
    domain_id: 0, title: '', desc: '', points: 10, dueDate: '', assignedTo: []
  });

  const [deleteTaskModalId, setDeleteTaskModalId] = useState<number | null>(null);
  const [updateTaskData, setUpdateTaskData] = useState<Task | null>(null);

  const canCreateTask = isLeadPlus(currentRole);
  const canManageAssignment = roleAtLeast(currentRole, "associate");

  const { data: tasks = [] } = useQuery({
    queryKey: ["club", clubId, "tasks"],
    queryFn: () => listTasks(clubId),
  });
  const { data: membersData = [] } = useQuery({
    queryKey: ["club", clubId, "members"],
    queryFn: () => listMembers(clubId),
  });
  const { data: domainsData = [] } = useQuery({
    queryKey: ["club", clubId, "domains"],
    queryFn: () => listDomains(clubId),
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "tasks"] });
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "members"] });
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "leaderboard"] });
  };

  // Members grouped by domain for the assign UI.
  const domainMembers: Record<number, { id: number, name: string, initials: string }[]> = {};
  membersData.forEach((m) => {
    if (m.domain_id == null) return;
    if (!domainMembers[m.domain_id]) domainMembers[m.domain_id] = [];
    domainMembers[m.domain_id].push({
      id: m.user_id,
      name: m.name,
      initials: m.name.substring(0, 2).toUpperCase(),
    });
  });
  const domainsList = domainsData.map((d) => ({ id: d.id, name: d.name }));

  // Task-hierarchy: only a task's creator, or someone who outranks the creator's
  // current role, may edit or delete it. Mirrors the backend's _can_modify_task.
  const memberRoleById = new Map(membersData.map((m) => [m.user_id, m.role]));
  const canModifyTask = (task: Task): boolean => {
    if (userId === task.creator_id) return true;
    const creatorRole = memberRoleById.get(task.creator_id);
    if (!creatorRole) return isLeadPlus(currentRole);
    return canManage(currentRole, creatorRole);
  };

  const toggleExpand = (taskId: number) => {
    const isCurrentlyExpanded = expandedTasks.has(taskId);
    if (isCurrentlyExpanded) {
      // Collapsing: let the height animation run against the still-full text; the
      // text itself swaps down to the truncated preview once that animation settles.
      setExpandedTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    } else {
      setExpandedTasks((prev) => new Set(prev).add(taskId));
      setFullTextTasks((prev) => new Set(prev).add(taskId));
    }
  };

  const handleDescCollapseComplete = (taskId: number) => {
    setFullTextTasks((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const handleOpenModal = (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setAssignModalTask(taskId);
      setSelectedUsers(task.assignees.map(a => a.id));
    }
  };

  const handleToggleUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirmAssign = async () => {
    if (assignModalTask) {
      try {
        await assignTask(clubId, assignModalTask, selectedUsers);
        refetch();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Failed to assign.");
      }
    }
    setAssignModalTask(null);
  };

  const handleConfirmAccept = async () => {
    if (acceptTaskId) {
      try {
        await acceptTask(clubId, acceptTaskId);
        refetch();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Failed to accept task.");
      }
    }
    setAcceptTaskId(null);
  };

  const confirmDeleteTask = async () => {
    if (deleteTaskModalId) {
      try {
        await deleteTask(clubId, deleteTaskModalId);
        setDeleteTaskModalId(null);
        refetch();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Failed to delete task.");
      }
    }
  };

  const confirmUpdateTask = async () => {
    if (updateTaskData) {
      try {
        await updateTask(clubId, updateTaskData.id, {
          title: updateTaskData.title,
          description: updateTaskData.description || null,
          due_date: updateTaskData.due_date || null,
          points: updateTaskData.points,
          status: updateTaskData.status
        });
        setUpdateTaskData(null);
        refetch();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Failed to update task.");
      }
    }
  };

  const handleCreateTask = async () => {
    const domainId = newTaskData.domain_id || domainsList[0]?.id;
    if (!domainId) { alert("Please select a domain."); return; }
    if (!newTaskData.title.trim()) { alert("Please enter a title."); return; }
    try {
      await createTask(clubId, {
        domain_id: domainId,
        title: newTaskData.title,
        description: newTaskData.desc || null,
        points: newTaskData.points,
        due_date: newTaskData.dueDate || null,
        assignee_ids: newTaskData.assignedTo
      });
      setIsNewTaskModalOpen(false);
      setNewTaskData({ domain_id: domainsList[0]?.id || 0, title: '', desc: '', points: 10, dueDate: '', assignedTo: [] });
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create task.");
    }
  };

  const modalTask = tasks.find(t => t.id === assignModalTask);
  const modalMembers = modalTask ? (domainMembers[modalTask.domain_id] || []) : [];
  const acceptModalTask = tasks.find(t => t.id === acceptTaskId);

  const renderTask = (task: Task) => {
    const isExpanded = expandedTasks.has(task.id);
    const showFullText = fullTextTasks.has(task.id);
    const isLongDesc = (task.description?.length ?? 0) > DESC_TRUNCATE_LENGTH;
    const canManageThisTask = task.status !== 'completed' && canModifyTask(task);
    // Member, Associate, and Lead are all domain-scoped, so all three may self-accept
    // an unassigned task first-come-first-served. Associate/Lead additionally clear
    // canManageAssignment, so they see both Assign (manage someone else's) and Accept
    // (take it themselves) side by side; exec roles only ever get Assign.
    const canAccept =
      task.status !== 'completed' &&
      task.assignees.length === 0 &&
      isDomainScoped(currentRole);

    return (
      <article key={task.id} className={`${task.status === 'completed' ? 'bg-[#ebe6db] opacity-60' : 'bg-paper'} border-2 border-black p-3 ${task.status === 'in_progress' ? 'border-l-4 border-l-[#057DBC]' : ''} relative group/task`}>

        {canManageThisTask && (
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/task:opacity-100 transition-opacity z-10 bg-paper/90 rounded px-1">
            <button onClick={() => setUpdateTaskData(task)} className="text-[#757575] hover:text-[#057DBC]" title="Update">
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button onClick={() => setDeleteTaskModalId(task.id)} className="text-[#757575] hover:text-red-600" title="Delete">
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-2">
          <span className={`inline-block text-paper font-mono text-[11px] uppercase px-2 py-0.5 rounded-[1920px] ${task.status === 'completed' ? 'bg-[#757575]' : 'bg-black'}`}>
            {task.domain_name}
          </span>
          <span className="inline-block text-[#057DBC] font-mono text-[11px] uppercase px-2 py-0.5 rounded-[1920px] border border-[#057DBC]">
            {task.points} PTS
          </span>
        </div>
        <h3 className={`font-display text-[26px] leading-[1.08] text-${task.status === 'completed' ? 'caption-gray' : 'black'} mb-2 ${task.status === 'completed' ? 'line-through' : ''}`}>
          {task.title}
        </h3>
        {task.description && (
          <div className="mb-3">
            {isLongDesc ? (
              <>
                <motion.div
                  initial={{ height: DESC_COLLAPSED_HEIGHT }}
                  animate={{ height: isExpanded ? "auto" : DESC_COLLAPSED_HEIGHT }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  onAnimationComplete={() => { if (!isExpanded) handleDescCollapseComplete(task.id); }}
                  style={{ overflow: "hidden" }}
                >
                  <p
                    className="font-body text-14 text-caption-gray leading-snug break-words whitespace-pre-wrap cursor-pointer"
                    onClick={() => toggleExpand(task.id)}
                  >
                    {showFullText ? task.description : truncateText(task.description, DESC_TRUNCATE_LENGTH)}
                  </p>
                </motion.div>
                <button
                  onClick={() => toggleExpand(task.id)}
                  className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#057DBC] hover:underline mt-1"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              </>
            ) : (
              <p className="font-body text-14 text-caption-gray leading-snug break-words whitespace-pre-wrap">
                {task.description}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-between items-center mt-auto border-t border-hairline-tint pt-2">
          {task.status === 'todo' && <span className="font-mono text-12 text-caption-gray">Due: {task.due_date || 'N/A'}</span>}
          {task.status === 'in_progress' && <span className="font-mono text-12 text-caption-gray">In Progress</span>}
          {task.status === 'completed' && <span className="font-mono text-12 text-caption-gray">Done</span>}

          <div className="flex items-center">
            {task.assignees.length > 0 ? (
              <div
                className={`flex items-center gap-1 group ${task.status !== 'completed' && canManageAssignment ? 'cursor-pointer' : ''}`}
                onClick={() => task.status !== 'completed' && canManageAssignment && handleOpenModal(task.id)}
              >
                <span className={`font-ui text-[11px] text-[#757575] mr-1 transition-colors hidden sm:inline-block ${task.status !== 'completed' && canManageAssignment ? 'group-hover:text-black' : ''}`}>
                  {task.status === 'completed' ? 'Completed by:' : 'Assigned to:'}
                </span>
                <div className="flex -space-x-2">
                  {task.assignees.map(a => (
                    <div key={a.id} className="w-6 h-6 rounded-full bg-[#e8e4da] border-2 border-black flex items-center justify-center relative z-10 hover:z-20 hover:bg-black hover:text-paper transition-colors" title={a.name}>
                      <span className="font-mono text-[9px] uppercase tracking-tighter">{a.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : task.status !== 'completed' && (canManageAssignment || canAccept) ? (
              <div className="flex items-center gap-2">
                {canManageAssignment && (
                  <button
                    onClick={() => handleOpenModal(task.id)}
                    className="font-ui text-[11px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-paper px-2 py-0.5 uppercase hover:bg-paper hover:text-[#057DBC] transition-colors"
                  >
                    Assign
                  </button>
                )}
                {canAccept && (
                  <button
                    onClick={() => setAcceptTaskId(task.id)}
                    className="font-ui text-[11px] font-bold border-2 border-black bg-black text-paper px-2 py-0.5 uppercase hover:bg-paper hover:text-black transition-colors"
                  >
                    Accept
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="w-full relative">
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-paper px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            Tasks
          </h1>
        </div>
        {canCreateTask && (
          <button
            onClick={() => {
              setNewTaskData(prev => ({ ...prev, domain_id: domainsList[0]?.id || 0 }));
              setIsNewTaskModalOpen(true);
            }}
            className="bg-[#057DBC] text-paper font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-paper hover:text-[#057DBC] transition-colors uppercase shrink-0"
          >
            New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-3 lg:border-r-2 border-black lg:pr-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">To Do</h2>
          {(() => {
            const todo = tasks.filter(t => t.status === 'todo');
            return todo.length > 0 ? todo.map(renderTask) : <EmptyColumn hint="New tasks will land here." />;
          })()}
        </div>
        <div className="flex flex-col gap-3 lg:border-r-2 border-black lg:px-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">In Progress</h2>
          {(() => {
            const inProgress = tasks.filter(t => t.status === 'in_progress');
            return inProgress.length > 0 ? inProgress.map(renderTask) : <EmptyColumn hint="Nobody's working on anything yet." />;
          })()}
        </div>
        <div className="flex flex-col gap-3 lg:pl-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">Completed</h2>
          {(() => {
            const completed = tasks.filter(t => t.status === 'completed');
            return completed.length > 0 ? completed.map(renderTask) : <EmptyColumn hint="Finished tasks will show up here." />;
          })()}
        </div>
      </div>

      <AnimatePresence>
        {assignModalTask && modalTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-paper border-2 border-black w-full max-w-sm flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">
                  Assign Members
                </h2>
                <button onClick={() => setAssignModalTask(null)} className="text-paper hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6">
                <p className="font-ui text-14 mb-4 text-[#757575] leading-snug">
                  Select members from the <strong>{modalTask.domain_name}</strong> domain to assign to this task.
                </p>
                <div className="flex flex-col gap-2 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                  {modalMembers.length > 0 ? modalMembers.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 cursor-pointer p-2 border-2 border-transparent hover:bg-hairline-tint transition-colors"
                      onClick={(e) => { e.preventDefault(); handleToggleUser(member.id); }}
                    >
                      <div className="relative w-5 h-5 flex items-center justify-center border-2 border-black bg-paper shrink-0">
                        {selectedUsers.includes(member.id) && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 bg-black" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#e8e4da] border-2 border-black flex items-center justify-center">
                          <span className="font-mono text-[10px] uppercase tracking-tighter">{member.initials}</span>
                        </div>
                        <span className="font-ui text-14 font-bold">{member.name}</span>
                      </div>
                    </label>
                  )) : (
                    <p className="font-mono text-12 text-[#757575] uppercase">No members available in this domain.</p>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                  <button onClick={() => setAssignModalTask(null)} className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-paper transition-colors">Cancel</button>
                  <button onClick={handleConfirmAssign} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-paper px-4 py-2 uppercase hover:bg-paper hover:text-[#057DBC] transition-colors">Confirm</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {acceptTaskId && acceptModalTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-paper border-2 border-black w-full max-w-sm flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Accept Task</h2>
                <button onClick={() => setAcceptTaskId(null)} className="text-paper hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-3">
                <span className="inline-block text-paper font-mono text-[11px] uppercase px-2 py-0.5 rounded-[1920px] bg-black w-max">
                  {acceptModalTask.domain_name}
                </span>
                <h3 className="font-display text-[26px] leading-[1.08] text-black">{acceptModalTask.title}</h3>
                {acceptModalTask.description && (
                  <p className="font-body text-14 text-caption-gray whitespace-pre-wrap leading-snug">
                    {acceptModalTask.description}
                  </p>
                )}
                <div className="flex justify-between items-center border-t border-hairline-tint pt-2 font-mono text-12 text-caption-gray">
                  <span>Due: {acceptModalTask.due_date || 'N/A'}</span>
                  <span>{acceptModalTask.points} PTS</span>
                </div>
                <p className="font-ui text-12 text-[#757575] leading-snug">
                  This task is unassigned. Accepting it is first come, first served — it will be assigned to you immediately.
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-black mt-1">
                  <button onClick={() => setAcceptTaskId(null)} className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-paper transition-colors">Cancel</button>
                  <button onClick={handleConfirmAccept} className="font-ui text-12 font-bold border-2 border-black bg-black text-paper px-4 py-2 uppercase hover:bg-paper hover:text-black transition-colors">Confirm</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNewTaskModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-paper border-2 border-black w-full max-w-lg flex flex-col my-8">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Create New Task</h2>
                <button onClick={() => setIsNewTaskModalOpen(false)} className="text-paper hover:text-red-500 transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
              </div>
              <div className="p-6 flex flex-col gap-4">

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain</label>
                  <select
                    value={newTaskData.domain_id}
                    onChange={e => setNewTaskData({...newTaskData, domain_id: parseInt(e.target.value), assignedTo: []})}
                    className="border-2 border-black p-2 font-ui text-14 bg-paper outline-none focus:border-[#057DBC]"
                  >
                    {domainsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Heading</label>
                  <input type="text" value={newTaskData.title} onChange={e => setNewTaskData({...newTaskData, title: e.target.value})} placeholder="Enter task heading..." className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea value={newTaskData.desc} onChange={e => setNewTaskData({...newTaskData, desc: e.target.value})} placeholder="Full description of the task..." className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Points</label>
                  <div className="flex gap-2">
                    {TASK_POINTS_OPTIONS.map(pts => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setNewTaskData({...newTaskData, points: pts})}
                        className={`flex-1 border-2 py-2 font-ui text-14 font-bold uppercase transition-colors ${
                          newTaskData.points === pts
                            ? 'border-[#057DBC] bg-[#057DBC] text-paper'
                            : 'border-black hover:bg-hairline-tint'
                        }`}
                      >
                        {pts}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Due Date (Optional)</label>
                  <input type="date" value={newTaskData.dueDate} onChange={e => setNewTaskData({...newTaskData, dueDate: e.target.value})} className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Assign Members (Optional)</label>
                  <div className="border-2 border-black p-2 max-h-32 overflow-y-auto flex flex-col gap-1">
                    {(domainMembers[newTaskData.domain_id] || []).length > 0 ? (
                      domainMembers[newTaskData.domain_id].map(member => (
                        <label key={member.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-hairline-tint transition-colors">
                          <input
                            type="checkbox"
                            checked={newTaskData.assignedTo.includes(member.id)}
                            onChange={(e) => {
                              const newAssigned = e.target.checked
                                ? [...newTaskData.assignedTo, member.id]
                                : newTaskData.assignedTo.filter(id => id !== member.id);
                              setNewTaskData({...newTaskData, assignedTo: newAssigned});
                            }}
                            className="w-4 h-4 accent-black border-2 border-black"
                          />
                          <span className="font-ui text-14">{member.name}</span>
                        </label>
                      ))
                    ) : (
                      <span className="font-mono text-11 text-[#757575]">No members available</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setIsNewTaskModalOpen(false)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-paper transition-colors">Cancel</button>
                  <button onClick={handleCreateTask} disabled={!newTaskData.title.trim()} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-paper px-6 py-2 uppercase hover:bg-paper hover:text-[#057DBC] transition-colors disabled:opacity-50">Create Task</button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTaskModalId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-paper border-2 border-black w-full max-w-sm flex flex-col">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Confirm Deletion</h2>
              </div>
              <div className="p-6 flex flex-col gap-4 text-center">
                <span className="material-symbols-outlined text-red-600 text-5xl mx-auto">warning</span>
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this task?</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteTaskModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-paper transition-colors">Cancel</button>
                  <button onClick={confirmDeleteTask} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-paper px-6 py-2 uppercase hover:bg-paper hover:text-red-600 transition-colors">Delete</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updateTaskData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-paper border-2 border-black w-full max-w-md flex flex-col my-8">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-paper font-mono text-12 uppercase tracking-widest">Update Task</h2>
                <button onClick={() => setUpdateTaskData(null)} className="text-paper hover:text-red-500 transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
              </div>
              <div className="p-6 flex flex-col gap-4">

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Status</label>
                  <select
                    value={updateTaskData.status}
                    onChange={e => setUpdateTaskData({...updateTaskData, status: e.target.value as TaskStatus})}
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Heading / Title</label>
                  <input type="text" value={updateTaskData.title} onChange={e => setUpdateTaskData({...updateTaskData, title: e.target.value})} className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea value={updateTaskData.description ?? ''} onChange={e => setUpdateTaskData({...updateTaskData, description: e.target.value})} className="border-2 border-black p-2 font-ui text-14 resize-none h-20 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Points</label>
                  <div className="flex gap-2">
                    {TASK_POINTS_OPTIONS.map(pts => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setUpdateTaskData({...updateTaskData, points: pts})}
                        className={`flex-1 border-2 py-2 font-ui text-14 font-bold uppercase transition-colors ${
                          updateTaskData.points === pts
                            ? 'border-[#057DBC] bg-[#057DBC] text-paper'
                            : 'border-black hover:bg-hairline-tint'
                        }`}
                      >
                        {pts}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Due Date</label>
                  <input type="date" value={updateTaskData.due_date ?? ''} onChange={e => setUpdateTaskData({...updateTaskData, due_date: e.target.value || null})} className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setUpdateTaskData(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-paper transition-colors">Cancel</button>
                  <button onClick={confirmUpdateTask} disabled={!updateTaskData.title.trim()} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-paper px-6 py-2 uppercase hover:bg-paper hover:text-[#057DBC] transition-colors disabled:opacity-50">Save Changes</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
