"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Leaderboard, { LeaderboardMember } from "./Leaderboard";
import { useDashboard } from "../DashboardContext";
import api from "@/lib/axios";

type Task = {
  id: number;
  domain_name: string;
  domain_id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  due_date: string | null;
  created_at: string;
  assignees: { id: number, name: string }[];
};

export default function TaskBoardPage() {
  const { clubId, currentRole } = useDashboard();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignModalTask, setAssignModalTask] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [domainMembers, setDomainMembers] = useState<Record<number, { id: number, name: string, initials: string }[]>>({});
  const [domainsList, setDomainsList] = useState<{ id: number, name: string }[]>([]);

  // New Task Modal state
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState<{ domain_id: number, title: string, desc: string, dueDate: string, assignedTo: number[] }>({
    domain_id: 0, title: '', desc: '', dueDate: '', assignedTo: []
  });

  const [deleteTaskModalId, setDeleteTaskModalId] = useState<number | null>(null);
  const [updateTaskData, setUpdateTaskData] = useState<Task | null>(null);

  const canCreateTask = ['president', 'vice_president', 'secretary', 'joint_secretary', 'lead'].includes(currentRole);

  const fetchData = async () => {
    if (!clubId) return;
    try {
      const [tasksRes, memRes, domRes] = await Promise.all([
        api.get(`/clubs/${clubId}/tasks`, { headers: { "X-Club-ID": String(clubId) } }),
        api.get(`/clubs/${clubId}/members`, { headers: { "X-Club-ID": String(clubId) } }),
        api.get(`/clubs/${clubId}/domains`, { headers: { "X-Club-ID": String(clubId) } })
      ]);

      setTasks(tasksRes.data);
      
      const membersData: LeaderboardMember[] = memRes.data
        .filter((m: any) => m.role === 'member')
        .map((m: any) => ({
          id: m.user_id,
          name: m.name,
          domain: m.domain_name || "General",
          points: m.points || 0,
          pic: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=e2e2e2&color=000&size=150`
        }));
      setMembers(membersData);

      const dMembers: Record<number, { id: number, name: string, initials: string }[]> = {};
      memRes.data.forEach((m: any) => {
        if (!dMembers[m.domain_id]) dMembers[m.domain_id] = [];
        dMembers[m.domain_id].push({
          id: m.user_id,
          name: m.name,
          initials: m.name.substring(0, 2).toUpperCase()
        });
      });
      setDomainMembers(dMembers);

      setDomainsList(domRes.data.map((d: any) => ({ id: d.id, name: d.name })));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clubId]);

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
        await api.post(`/clubs/${clubId}/tasks/${assignModalTask}/assign`, {
          assignee_ids: selectedUsers
        }, { headers: { "X-Club-ID": String(clubId) } });
        fetchData();
      } catch (e) {
        console.error(e);
      }
    }
    setAssignModalTask(null);
  };

  const confirmDeleteTask = async () => {
    if (deleteTaskModalId) {
      try {
        await api.delete(`/clubs/${clubId}/tasks/${deleteTaskModalId}`, { headers: { "X-Club-ID": String(clubId) } });
        setDeleteTaskModalId(null);
        fetchData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const confirmUpdateTask = async () => {
    if (updateTaskData) {
      try {
        await api.put(`/clubs/${clubId}/tasks/${updateTaskData.id}`, {
          title: updateTaskData.title,
          description: updateTaskData.description || null,
          due_date: updateTaskData.due_date || null,
          status: updateTaskData.status
        }, { headers: { "X-Club-ID": String(clubId) } });
        setUpdateTaskData(null);
        fetchData();
      } catch (e: any) {
        alert(e.message || "Failed to update task.");
        console.error(e);
      }
    }
  };

  const handleCreateTask = async () => {
    const domainId = newTaskData.domain_id || domainsList[0]?.id;
    if (!domainId) { alert("Please select a domain."); return; }
    if (!newTaskData.title.trim()) { alert("Please enter a title."); return; }
    try {
      await api.post(`/clubs/${clubId}/tasks`, {
        domain_id: domainId,
        title: newTaskData.title,
        description: newTaskData.desc || null,
        due_date: newTaskData.dueDate || null,
        assignee_ids: newTaskData.assignedTo
      }, { headers: { "X-Club-ID": String(clubId) } });
      setIsNewTaskModalOpen(false);
      setNewTaskData({ domain_id: domainsList[0]?.id || 0, title: '', desc: '', dueDate: '', assignedTo: [] });
      fetchData();
    } catch (e: any) {
      alert(e.message || "Failed to create task.");
      console.error(e);
    }
  };

  const modalTask = tasks.find(t => t.id === assignModalTask);
  const modalMembers = modalTask ? (domainMembers[modalTask.domain_id] || []) : [];

  const renderTask = (task: Task) => (
    <article key={task.id} className={`${task.status === 'completed' ? 'bg-[#f3f3f3] opacity-60' : 'bg-white'} border-2 border-black p-3 ${task.status === 'in_progress' ? 'border-l-4 border-l-[#057DBC]' : ''} relative group/task`}>
      
      {task.status !== 'completed' && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/task:opacity-100 transition-opacity z-10 bg-white/90 rounded px-1">
          <button onClick={() => setUpdateTaskData(task)} className="text-[#757575] hover:text-[#057DBC]" title="Update">
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button onClick={() => setDeleteTaskModalId(task.id)} className="text-[#757575] hover:text-red-600" title="Delete">
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      )}

      <span className={`inline-block text-white font-mono text-[11px] uppercase px-2 py-0.5 rounded-[1920px] mb-2 ${task.status === 'completed' ? 'bg-[#757575]' : 'bg-black'}`}>
        {task.domain_name}
      </span>
      <h3 className={`font-display text-[26px] leading-[1.08] text-${task.status === 'completed' ? 'caption-gray' : 'black'} mb-2 ${task.status === 'completed' ? 'line-through' : ''}`}>
        {task.title}
      </h3>
      {task.description && (
        <p className="font-body text-14 text-caption-gray mb-3 line-clamp-2 leading-snug">{task.description}</p>
      )}
      <div className="flex justify-between items-center mt-auto border-t border-hairline-tint pt-2">
        {task.status === 'todo' && <span className="font-mono text-12 text-caption-gray">Due: {task.due_date || 'N/A'}</span>}
        {task.status === 'in_progress' && <span className="font-mono text-12 text-caption-gray">In Progress</span>}
        {task.status === 'completed' && <span className="font-mono text-12 text-caption-gray">Done</span>}
        
        <div className="flex items-center">
          {task.assignees.length > 0 ? (
            <div className={`flex items-center gap-1 group ${task.status !== 'completed' ? 'cursor-pointer' : ''}`} onClick={() => task.status !== 'completed' && handleOpenModal(task.id)}>
              <span className={`font-ui text-[11px] text-[#757575] mr-1 transition-colors hidden sm:inline-block ${task.status !== 'completed' ? 'group-hover:text-black' : ''}`}>
                {task.status === 'completed' ? 'Completed by:' : 'Assigned to:'}
              </span>
              <div className="flex -space-x-2">
                {task.assignees.map(a => {
                  const member = domainMembers[task.domain_id]?.find(m => m.id === a.id);
                  return member ? (
                    <div key={a.id} className="w-6 h-6 rounded-full bg-[#e2e2e2] border-2 border-black flex items-center justify-center relative z-10 hover:z-20 hover:bg-black hover:text-white transition-colors" title={member.name}>
                      <span className="font-mono text-[9px] uppercase tracking-tighter">{member.initials}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ) : task.status !== 'completed' ? (
            <button 
              onClick={() => handleOpenModal(task.id)} 
              className="font-ui text-[11px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-2 py-0.5 uppercase hover:bg-white hover:text-[#057DBC] transition-colors"
            >
              Assign
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );

  return (
    <div className="w-full relative">
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-white px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            Tasks
          </h1>
        </div>
        {canCreateTask && (
          <button 
            onClick={() => {
              setNewTaskData(prev => ({ ...prev, domain_id: domainsList[0]?.id || 0 }));
              setIsNewTaskModalOpen(true);
            }} 
            className="bg-[#057DBC] text-white font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-white hover:text-[#057DBC] transition-colors uppercase shrink-0"
          >
            New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-3 lg:border-r-2 border-black lg:pr-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">To Do</h2>
          {tasks.filter(t => t.status === 'todo').map(renderTask)}
        </div>
        <div className="flex flex-col gap-3 lg:border-r-2 border-black lg:px-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">In Progress</h2>
          {tasks.filter(t => t.status === 'in-progress').map(renderTask)}
        </div>
        <div className="flex flex-col gap-3 lg:pl-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">Completed</h2>
          {tasks.filter(t => t.status === 'completed').map(renderTask)}
        </div>
      </div>

      <Leaderboard members={members} />

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
              className="bg-white border-2 border-black w-full max-w-sm flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">
                  Assign Members
                </h2>
                <button onClick={() => setAssignModalTask(null)} className="text-white hover:text-red-500 transition-colors">
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
                      <div className="relative w-5 h-5 flex items-center justify-center border-2 border-black bg-white shrink-0">
                        {selectedUsers.includes(member.id) && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 bg-black" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#e2e2e2] border-2 border-black flex items-center justify-center">
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
                  <button onClick={() => setAssignModalTask(null)} className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleConfirmAssign} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-4 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors">Confirm</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNewTaskModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border-2 border-black w-full max-w-lg flex flex-col my-8">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Create New Task</h2>
                <button onClick={() => setIsNewTaskModalOpen(false)} className="text-white hover:text-red-500 transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain</label>
                  <select 
                    value={newTaskData.domain_id} 
                    onChange={e => setNewTaskData({...newTaskData, domain_id: parseInt(e.target.value), assignedTo: []})}
                    className="border-2 border-black p-2 font-ui text-14 bg-white outline-none focus:border-[#057DBC]"
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
                  <button onClick={() => setIsNewTaskModalOpen(false)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleCreateTask} disabled={!newTaskData.title.trim()} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50">Create Task</button>
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTaskModalId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border-2 border-black w-full max-w-sm flex flex-col">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Confirm Deletion</h2>
              </div>
              <div className="p-6 flex flex-col gap-4 text-center">
                <span className="material-symbols-outlined text-red-600 text-5xl mx-auto">warning</span>
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this task?</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteTaskModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={confirmDeleteTask} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-white px-6 py-2 uppercase hover:bg-white hover:text-red-600 transition-colors">Delete</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updateTaskData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border-2 border-black w-full max-w-md flex flex-col my-8">
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Update Task</h2>
                <button onClick={() => setUpdateTaskData(null)} className="text-white hover:text-red-500 transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Status</label>
                  <select 
                    value={updateTaskData.status} 
                    onChange={e => setUpdateTaskData({...updateTaskData, status: e.target.value as 'todo' | 'in_progress' | 'completed'})}
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
                  <textarea value={updateTaskData.description} onChange={e => setUpdateTaskData({...updateTaskData, description: e.target.value})} className="border-2 border-black p-2 font-ui text-14 resize-none h-20 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Due Date</label>
                  <input type="date" value={updateTaskData.due_date ?? ''} onChange={e => setUpdateTaskData({...updateTaskData, due_date: e.target.value || null})} className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]" />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setUpdateTaskData(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">Cancel</button>
                  <button onClick={confirmUpdateTask} disabled={!updateTaskData.title.trim()} className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50">Save Changes</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
