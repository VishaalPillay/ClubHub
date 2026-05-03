"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Leaderboard from "./Leaderboard";

type Task = {
  id: string;
  domain: string;
  title: string;
  desc?: string;
  status: 'todo' | 'in-progress' | 'completed';
  dueDate?: string;
  doneDate?: string;
  progress?: string;
  assignedTo: string[];
};

const DOMAIN_MEMBERS: Record<string, { id: string, name: string, initials: string }[]> = {
  "Technical": [
    { id: "t1", name: "Alex Chen", initials: "AC" },
    { id: "t2", name: "Samira Tariq", initials: "ST" },
    { id: "t3", name: "John Doe", initials: "JD" },
    { id: "t4", name: "Mike K.", initials: "MK" }
  ],
  "Corporate": [
    { id: "c1", name: "Alice R.", initials: "AR" },
    { id: "c2", name: "Liam Davis", initials: "LD" }
  ],
  "Creative": [
    { id: "cr1", name: "Maya Lin", initials: "ML" },
    { id: "cr2", name: "Jordan Smith", initials: "JS" }
  ]
};

const initialTasks: Task[] = [
  { id: "task1", domain: "Technical", title: "Implement High-Contrast Color Palette in Legacy Modules", status: "todo", dueDate: "Oct 12", assignedTo: ["t3"] },
  { id: "task2", domain: "Corporate", title: "Draft Editorial Guidelines for Q4 Publications", status: "todo", dueDate: "Oct 15", assignedTo: [] },
  { id: "task3", domain: "Technical", title: "Migrate Core Database to New Archival Infrastructure", desc: "Data synchronization is currently running at 85%. Expecting completion by EOD.", status: "in-progress", progress: "85%", assignedTo: ["t4"] },
  { id: "task4", domain: "Creative", title: "Establish Grid System Typography Ratios", status: "completed", doneDate: "Oct 01", assignedTo: [] },
  { id: "task5", domain: "Creative", title: "Finalize Standard Component Library JSON", status: "completed", doneDate: "Sep 28", assignedTo: [] }
];

export default function TaskBoardPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [assignModalTask, setAssignModalTask] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // New Task Modal state
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState<{ domain: string, title: string, desc: string, dueDate: string, assignedTo: string[] }>({
    domain: 'Technical', title: '', desc: '', dueDate: '', assignedTo: []
  });

  const [deleteTaskModalId, setDeleteTaskModalId] = useState<string | null>(null);
  const [updateTaskData, setUpdateTaskData] = useState<Task | null>(null);

  const handleOpenModal = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setAssignModalTask(taskId);
      setSelectedUsers([...task.assignedTo]);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirmAssign = () => {
    if (assignModalTask) {
      setTasks(tasks.map(t => t.id === assignModalTask ? { ...t, assignedTo: selectedUsers } : t));
    }
    setAssignModalTask(null);
  };

  const confirmDeleteTask = () => {
    if (deleteTaskModalId) {
      setTasks(tasks.filter(t => t.id !== deleteTaskModalId));
      setDeleteTaskModalId(null);
    }
  };

  const confirmUpdateTask = () => {
    if (updateTaskData) {
      setTasks(tasks.map(t => t.id === updateTaskData.id ? updateTaskData : t));
      setUpdateTaskData(null);
    }
  };

  const handleCreateTask = () => {
    const newTask: Task = {
      id: `task${Date.now()}`,
      domain: newTaskData.domain,
      title: newTaskData.title,
      desc: newTaskData.desc,
      status: 'todo',
      dueDate: newTaskData.dueDate,
      assignedTo: newTaskData.assignedTo
    };
    setTasks([newTask, ...tasks]);
    setIsNewTaskModalOpen(false);
    setNewTaskData({ domain: 'Technical', title: '', desc: '', dueDate: '', assignedTo: [] });
  };

  const modalTask = tasks.find(t => t.id === assignModalTask);
  const modalMembers = modalTask ? (DOMAIN_MEMBERS[modalTask.domain] || []) : [];

  const renderTask = (task: Task) => (
    <article key={task.id} className={`bg-${task.status === 'completed' ? '[#f3f3f3]' : 'white'} border-2 border-black p-3 ${task.status === 'in-progress' ? 'border-l-4 border-l-[#057DBC]' : ''} ${task.status === 'completed' ? 'opacity-60' : ''} relative group/task`}>
      
      {/* Three dot menu (Todo Only) */}
      {task.status === 'todo' && (
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
        {task.domain}
      </span>
      <h3 className={`font-display text-[26px] leading-[1.08] text-${task.status === 'completed' ? 'caption-gray' : 'black'} mb-2 ${task.status === 'completed' ? 'line-through' : ''}`}>
        {task.title}
      </h3>
      {task.desc && (
        <p className="font-body text-14 text-caption-gray mb-3 line-clamp-2 leading-snug">{task.desc}</p>
      )}
      <div className="flex justify-between items-center mt-auto border-t border-hairline-tint pt-2">
        {task.status === 'todo' && <span className="font-mono text-12 text-caption-gray">Due: {task.dueDate}</span>}
        {task.status === 'in-progress' && <span className="font-mono text-12 text-caption-gray">In Progress ({task.progress})</span>}
        {task.status === 'completed' && <span className="font-mono text-12 text-caption-gray">Done: {task.doneDate}</span>}
        
        <div className="flex items-center">
          {task.assignedTo.length > 0 ? (
            <div className={`flex items-center gap-1 group ${task.status !== 'completed' ? 'cursor-pointer' : ''}`} onClick={() => task.status !== 'completed' && handleOpenModal(task.id)}>
              <span className={`font-ui text-[11px] text-[#757575] mr-1 transition-colors hidden sm:inline-block ${task.status !== 'completed' ? 'group-hover:text-black' : ''}`}>
                {task.status === 'completed' ? 'Completed by:' : 'Assigned to:'}
              </span>
              <div className="flex -space-x-2">
                {task.assignedTo.map(uid => {
                  const member = DOMAIN_MEMBERS[task.domain]?.find(m => m.id === uid);
                  return member ? (
                    <div key={uid} className="w-6 h-6 rounded-full bg-[#e2e2e2] border-2 border-black flex items-center justify-center relative z-10 hover:z-20 hover:bg-black hover:text-white transition-colors" title={member.name}>
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
      {/* Editorial Ribbon Header */}
      <div className="flex justify-between items-end mb-6 w-full gap-4">
        <div className="flex flex-col flex-1">
          <div className="w-full h-[2px] bg-black"></div>
          <h1 className="bg-black text-white px-3 py-1 font-mono text-12 uppercase tracking-widest w-max inline-block">
            Tasks
          </h1>
        </div>
        <button 
          onClick={() => setIsNewTaskModalOpen(true)} 
          className="bg-[#057DBC] text-white font-ui text-12 font-bold px-4 py-1.5 border-2 border-[#057DBC] hover:bg-white hover:text-[#057DBC] transition-colors uppercase shrink-0"
        >
          New Task
        </button>
      </div>

      {/* Task Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* To Do Column */}
        <div className="flex flex-col gap-3 lg:border-r-2 border-black lg:pr-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">To Do</h2>
          {tasks.filter(t => t.status === 'todo').map(renderTask)}
        </div>

        {/* In Progress Column */}
        <div className="flex flex-col gap-3 lg:border-r-2 border-black lg:px-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">In Progress</h2>
          {tasks.filter(t => t.status === 'in-progress').map(renderTask)}
        </div>

        {/* Completed Column */}
        <div className="flex flex-col gap-3 lg:pl-4">
          <h2 className="font-display text-20 text-black border-b-2 border-black pb-0.5 uppercase tracking-tight font-bold">Completed</h2>
          {tasks.filter(t => t.status === 'completed').map(renderTask)}
        </div>

      </div>

      {/* Leaderboard Section */}
      <Leaderboard />

      {/* Assign Modal */}
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
                  Select members from the <strong>{modalTask.domain}</strong> domain to assign to this task.
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
                  <button 
                    onClick={() => setAssignModalTask(null)}
                    className="font-ui text-12 font-bold border-2 border-black px-4 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmAssign}
                    className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-4 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {isNewTaskModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-lg flex flex-col my-8"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Create New Task</h2>
                <button onClick={() => setIsNewTaskModalOpen(false)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Domain</label>
                  <select 
                    value={newTaskData.domain} 
                    onChange={e => setNewTaskData({...newTaskData, domain: e.target.value, assignedTo: []})}
                    className="border-2 border-black p-2 font-ui text-14 bg-white outline-none focus:border-[#057DBC]"
                  >
                    {Object.keys(DOMAIN_MEMBERS).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Heading</label>
                  <input 
                    type="text" 
                    value={newTaskData.title} 
                    onChange={e => setNewTaskData({...newTaskData, title: e.target.value})}
                    placeholder="Enter task heading..."
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea 
                    value={newTaskData.desc} 
                    onChange={e => setNewTaskData({...newTaskData, desc: e.target.value})}
                    placeholder="Full description of the task..."
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-24 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Due Date</label>
                  <input 
                    type="text" 
                    value={newTaskData.dueDate} 
                    onChange={e => setNewTaskData({...newTaskData, dueDate: e.target.value})}
                    placeholder="e.g. Oct 20"
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Assign Members (Optional)</label>
                  <div className="border-2 border-black p-2 max-h-32 overflow-y-auto flex flex-col gap-1">
                    {(DOMAIN_MEMBERS[newTaskData.domain] || []).length > 0 ? (
                      DOMAIN_MEMBERS[newTaskData.domain].map(member => (
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
                  <button 
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateTask}
                    disabled={!newTaskData.title.trim()}
                    className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50 disabled:hover:bg-[#057DBC] disabled:hover:text-white"
                  >
                    Create Task
                  </button>
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTaskModalId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-sm flex flex-col"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Confirm Deletion</h2>
              </div>
              <div className="p-6 flex flex-col gap-4 text-center">
                <span className="material-symbols-outlined text-red-600 text-5xl mx-auto">warning</span>
                <p className="font-body text-16 text-[#4c4546]">Are you sure you want to delete this task?</p>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setDeleteTaskModalId(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirmDeleteTask} className="font-ui text-12 font-bold border-2 border-red-600 bg-red-600 text-white px-6 py-2 uppercase hover:bg-white hover:text-red-600 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Task Modal */}
      <AnimatePresence>
        {updateTaskData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white border-2 border-black w-full max-w-md flex flex-col my-8"
            >
              <div className="bg-black px-4 py-3 flex justify-between items-center">
                <h2 className="text-white font-mono text-12 uppercase tracking-widest">Update Task</h2>
                <button onClick={() => setUpdateTaskData(null)} className="text-white hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Heading / Title</label>
                  <input 
                    type="text" 
                    value={updateTaskData.title} 
                    onChange={e => setUpdateTaskData({...updateTaskData, title: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Description</label>
                  <textarea 
                    value={updateTaskData.desc} 
                    onChange={e => setUpdateTaskData({...updateTaskData, desc: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 resize-none h-20 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-10 uppercase tracking-widest text-[#757575]">Due Date</label>
                  <input 
                    type="text" 
                    value={updateTaskData.dueDate} 
                    onChange={e => setUpdateTaskData({...updateTaskData, dueDate: e.target.value})}
                    className="border-2 border-black p-2 font-ui text-14 outline-none focus:border-[#057DBC]"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setUpdateTaskData(null)} className="font-ui text-12 font-bold border-2 border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={confirmUpdateTask}
                    disabled={!updateTaskData.title.trim()}
                    className="font-ui text-12 font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-6 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
                
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
