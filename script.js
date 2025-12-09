// State
let appData = {
    date: new Date().toDateString(),
    projects: []
};

let timers = {}; // Map of taskId -> intervalId

// Icons (SVG strings for reuse)
const ICONS = {
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    render();
});

function loadData() {
    const stored = localStorage.getItem('glassTodoData_v2');
    if (stored) {
        const parsed = JSON.parse(stored);
        // Day Rollover Check
        if (parsed.date !== new Date().toDateString()) {
            handleRollover(parsed);
        } else {
            appData = parsed;
        }
    } else {
        // Default State
        appData.projects = [
            {
                id: Date.now(),
                title: "",
                tasks: []
            }
        ];
    }
}

function saveData() {
    localStorage.setItem('glassTodoData_v2', JSON.stringify(appData));
}

function handleRollover(oldData) {
    const today = new Date().toDateString();
    const overdueProjects = [];

    oldData.projects.forEach(p => {
        const pending = p.tasks.filter(t => t.status !== 'done');
        if (pending.length > 0) {
            // Mark overdue
            pending.forEach(t => t.status = 'overdue');
            overdueProjects.push({
                id: Date.now() + Math.random(),
                title: p.title || "Untitled Project",
                tasks: pending
            });
        }
    });

    appData = {
        date: today,
        projects: overdueProjects.length > 0 ? overdueProjects : [{ id: Date.now(), title: "", tasks: [] }]
    };
    
    if (overdueProjects.length > 0) {
        alert(`Welcome back! Unfinished tasks from ${oldData.date} have been moved to today.`);
    }
    saveData();
}

// Rendering
function render() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    document.getElementById('current-date').innerText = appData.date;

    appData.projects.forEach((project, pIndex) => {
        const panel = document.createElement('div');
        panel.className = 'glass-panel';
        
        // Calculate Progress
        const total = project.tasks.length;
        const done = project.tasks.filter(t => t.status === 'done').length;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);

        // Header
        const header = document.createElement('div');
        header.className = 'main-heading-header';
        header.innerHTML = `
            <input type="text" class="main-heading-input" 
                placeholder="Enter Main Heading..." 
                value="${project.title}" 
                onchange="updateProjectTitle(${pIndex}, this.value)">
            <div class="progress-ring">${percent}%</div>
            <button class="btn" onclick="deleteProject(${pIndex})" title="Delete Project">${ICONS.trash}</button>
        `;

        // Task List
        const taskList = document.createElement('div');
        taskList.className = 'task-list';

        project.tasks.forEach((task, tIndex) => {
            const isRunning = !!timers[task.id];
            const statusClass = task.status === 'done' ? 'green' : 
                              (task.status === 'in-progress' || isRunning) ? 'yellow' : 
                              task.status === 'overdue' ? 'red' : '';

            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <div class="status-indicator ${statusClass}" onclick="toggleTaskStatus(${pIndex}, ${tIndex})"></div>
                <input type="text" class="task-input ${task.status === 'done' ? 'done' : ''}" 
                    placeholder="Sub task..." 
                    value="${task.title}" 
                    onchange="updateTaskTitle(${pIndex}, ${tIndex}, this.value)">
                
                <span class="timer-badge" id="timer-${task.id}">${formatTime(task.timeSpent)}</span>
                
                <div class="task-controls">
                    ${task.status !== 'done' ? `
                        ${isRunning ? 
                            `<button class="btn" onclick="pauseTask(${pIndex}, ${tIndex})">${ICONS.pause}</button>` : 
                            `<button class="btn" onclick="startTask(${pIndex}, ${tIndex})">${ICONS.play}</button>`
                        }
                    ` : ''}
                    <button class="btn" onclick="deleteTask(${pIndex}, ${tIndex})">${ICONS.trash}</button>
                </div>
            `;
            taskList.appendChild(item);
        });

        // Add Task Button (Small, inside card)
        const addTaskBtn = document.createElement('div');
        addTaskBtn.style.marginTop = '15px';
        addTaskBtn.style.textAlign = 'center';
        addTaskBtn.innerHTML = `
            <button class="btn" style="width:100%; border-radius: 12px; background: rgba(0,0,0,0.03);" onclick="addTask(${pIndex})">
                ${ICONS.plus} <span style="margin-left:8px; font-size:0.9rem;">Add Sub Task</span>
            </button>
        `;

        panel.appendChild(header);
        panel.appendChild(taskList);
        panel.appendChild(addTaskBtn);
        container.appendChild(panel);
    });
}

// Actions
function addProject() {
    appData.projects.push({
        id: Date.now(),
        title: "",
        tasks: []
    });
    saveData();
    render();
}

function updateProjectTitle(index, value) {
    appData.projects[index].title = value;
    saveData();
}

function deleteProject(index) {
    if (confirm("Delete this entire project?")) {
        appData.projects.splice(index, 1);
        saveData();
        render();
    }
}

function addTask(pIndex) {
    appData.projects[pIndex].tasks.push({
        id: Date.now() + Math.random(),
        title: "",
        status: 'pending',
        timeSpent: 0
    });
    saveData();
    render();
}

function updateTaskTitle(pIndex, tIndex, value) {
    appData.projects[pIndex].tasks[tIndex].title = value;
    saveData();
}

function deleteTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    if (timers[task.id]) clearInterval(timers[task.id]);
    
    appData.projects[pIndex].tasks.splice(tIndex, 1);
    saveData();
    render();
}

function toggleTaskStatus(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    
    if (task.status === 'done') {
        task.status = 'pending';
    } else {
        // Stop timer if running
        if (timers[task.id]) {
            clearInterval(timers[task.id]);
            delete timers[task.id];
        }
        task.status = 'done';
    }
    saveData();
    render();
}

// Timer Logic
function startTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    
    // Stop all other timers (Single focus mode)
    Object.keys(timers).forEach(tid => {
        clearInterval(timers[tid]);
        delete timers[tid];
    });

    // Update status
    task.status = 'in-progress';
    saveData();
    render(); // Re-render to update icons

    // Start interval
    timers[task.id] = setInterval(() => {
        task.timeSpent++;
        // Update DOM directly for performance
        const badge = document.getElementById(`timer-${task.id}`);
        if (badge) badge.innerText = formatTime(task.timeSpent);
        
        // Save occasionally? Let's save on pause/stop to avoid thrashing storage
    }, 1000);
}

function pauseTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    if (timers[task.id]) {
        clearInterval(timers[task.id]);
        delete timers[task.id];
    }
    saveData();
    render();
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}

// Report Logic
function openReport() {
    const modal = document.getElementById('report-modal');
    const preview = document.getElementById('report-preview-content');
    
    // Generate Report HTML
    let totalTasks = 0;
    let completedTasks = 0;
    let totalTime = 0;
    let listHtml = '';

    appData.projects.forEach(p => {
        if (p.tasks.length === 0) return;
        
        listHtml += `<div style="margin-bottom: 15px;">
            <div style="font-weight:bold; margin-bottom:5px; color:#444;">${p.title || 'Untitled Project'}</div>`;
        
        p.tasks.forEach(t => {
            totalTasks++;
            if (t.status === 'done') completedTasks++;
            totalTime += t.timeSpent;
            
            const icon = t.status === 'done' ? '✓' : t.status === 'overdue' ? '!' : '•';
            const color = t.status === 'done' ? '#34c759' : t.status === 'overdue' ? '#ff3b30' : '#999';
            
            listHtml += `
                <div style="display:flex; justify-content:space-between; font-size:0.9rem; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <span style="color:${color}; margin-right:8px;">${icon}</span>
                    <span style="flex-grow:1; color: #333;">${t.title}</span>
                    <span style="font-family:monospace; color:#666;">${formatTime(t.timeSpent)}</span>
                </div>
            `;
        });
        
        listHtml += `</div>`;
    });

    document.getElementById('rep-date').innerText = appData.date;
    document.getElementById('rep-total').innerText = totalTasks;
    document.getElementById('rep-completed').innerText = completedTasks;
    document.getElementById('rep-time').innerText = formatTime(totalTime);
    document.getElementById('rep-list').innerHTML = listHtml;

    modal.classList.add('active');
}

function closeReport() {
    document.getElementById('report-modal').classList.remove('active');
}

function copyReportImage() {
    const element = document.getElementById('report-preview-content');
    
    // Use html2canvas
    if (typeof html2canvas !== 'undefined') {
        html2canvas(element, {
            backgroundColor: null, // Transparent or inherit
            scale: 2 // Retina quality
        }).then(canvas => {
            canvas.toBlob(blob => {
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                    alert('Report image copied to clipboard!');
                }).catch(err => {
                    console.error(err);
                    alert('Failed to copy image. Browser might not support it.');
                });
            });
        });
    } else {
        alert("Library loading... please wait or check internet connection.");
    }
}
