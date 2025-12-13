// State
let appData = {
    date: new Date().toDateString(),
    projects: []
};

let timers = {}; // Map of taskId -> intervalId
let pendingDeleteAction = null; // For confirmation modal

// Icons (SVG strings for reuse)
const ICONS = {
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    stop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>`,
    cross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    render();
});

function loadData() {
    const stored = localStorage.getItem('glassTodoData_v3');
    if (stored) {
        appData = JSON.parse(stored);
        
        // Restore active timers
        const now = Date.now();
        appData.projects.forEach(p => {
            p.tasks.forEach(t => {
                if (t.isActive && t.lastStartTime) {
                    // If lastTimeSpent is missing (legacy data), assume current timeSpent is the baseline
                    if (t.lastTimeSpent === undefined) {
                        t.lastTimeSpent = t.timeSpent;
                    }
                    
                    // We don't need to manually add elapsed time here anymore
                    // because runTimer will calculate it from lastStartTime
                    
                    runTimer(t);
                }
            });
        });
    } else {
        // Default State
        appData.projects = [];
        appData.date = new Date().toDateString();
    }
}

function saveData() {
    localStorage.setItem('glassTodoData_v3', JSON.stringify(appData));
}

// Rendering
function render() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    document.getElementById('current-date').innerText = appData.date;
    
    if (appData.projects.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">No tasks yet. Click "+ Add Task / Project" to get started.</div>`;
        // Don't return here, we still need to render the rest of the UI if needed
    }

    appData.projects.forEach((project, pIndex) => {
        const panel = document.createElement('div');
        panel.className = 'glass-panel';
        
        // Calculate Progress
        const total = project.tasks.length; // Include cancelled in total
        const done = project.tasks.filter(t => t.status === 'done').length;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);

        // Header
        const header = document.createElement('div');
        header.className = 'main-heading-header';
        header.innerHTML = `
            <input type="text" class="main-heading-input" 
                placeholder="Project Name" 
                value="${project.title}" 
                onchange="updateProjectTitle(${pIndex}, this.value)">
            <div class="progress-ring">${percent}%</div>
            <button class="btn" onclick="deleteProject(${pIndex})" title="Delete Project">${ICONS.trash}</button>
        `;

        // Task List
        const taskList = document.createElement('div');
        taskList.className = 'task-list';
        taskList.id = `task-list-${pIndex}`; // Add ID for easy appending

        project.tasks.forEach((task, tIndex) => {
            const isRunning = !!timers[task.id];
            const statusClass = task.status === 'done' ? 'green' : 
                              (task.status === 'in-progress' || isRunning) ? 'yellow' : 
                              task.status === 'overdue' ? 'red' : 
                              task.status === 'cancelled' ? 'grey' : '';

            const item = document.createElement('div');
            item.className = 'task-item';
            if (task.status === 'cancelled') item.style.opacity = '0.5';

            item.innerHTML = `
                <div class="status-indicator ${statusClass}" onclick="toggleTaskStatus(${pIndex}, ${tIndex})"></div>
                <textarea class="task-input ${task.status === 'done' || task.status === 'cancelled' ? 'done' : ''}" 
                    placeholder="Sub task..." 
                    rows="1"
                    oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"
                    onchange="updateTaskTitle(${pIndex}, ${tIndex}, this.value)">${task.title}</textarea>
                
                <span class="timer-badge" id="timer-${task.id}">${formatTime(task.timeSpent)}</span>
                
                <div class="task-controls">
                    ${task.status !== 'done' && task.status !== 'cancelled' ? `
                        ${isRunning ? 
                            `<button class="btn" title="Pause" onclick="pauseTask(${pIndex}, ${tIndex})">${ICONS.pause}</button>` : 
                            `<button class="btn" title="Start" onclick="startTask(${pIndex}, ${tIndex})">${ICONS.play}</button>`
                        }
                        <button class="btn" title="Mark Done" onclick="stopTask(${pIndex}, ${tIndex})">${ICONS.check}</button>
                        <button class="btn" title="Mark Not Completed" onclick="cancelTask(${pIndex}, ${tIndex})">${ICONS.cross}</button>
                    ` : ''}
                    <button class="btn" title="Delete" onclick="deleteTask(${pIndex}, ${tIndex})">${ICONS.trash}</button>
                </div>
            `;
            taskList.appendChild(item);
        });

        // Add Task Button (Small, inside card)
        const addTaskBtn = document.createElement('div');
        addTaskBtn.style.marginTop = '15px';
        addTaskBtn.style.textAlign = 'center';
        // Changed to showInlineAddTask
        addTaskBtn.innerHTML = `
            <button class="btn" style="width:100%; border-radius: 12px; background: rgba(0,0,0,0.03);" onclick="showInlineAddTask(${pIndex})">
                ${ICONS.plus} <span style="margin-left:8px; font-size:0.9rem;">Add Sub Task</span>
            </button>
        `;

        panel.appendChild(header);
        panel.appendChild(taskList);
        panel.appendChild(addTaskBtn);
        container.appendChild(panel);
    });
}

// Inline Add Form Logic
function showInlineAddTask(pIndex) {
    const taskList = document.getElementById(`task-list-${pIndex}`);
    
    // Create a temporary input row
    const tempRow = document.createElement('div');
    tempRow.className = 'task-item';
    // Removed borderLeft as per user request
    tempRow.innerHTML = `
        <div class="status-indicator"></div>
        <textarea class="task-input" placeholder="Type new task..." id="inline-input-${pIndex}" rows="1" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>
        <div class="task-controls">
            <button class="btn" onclick="submitInlineTask(${pIndex}, this.closest('.task-item'))">${ICONS.check}</button>
            <button class="btn" onclick="this.closest('.task-item').remove()">${ICONS.cross}</button>
        </div>
    `;
    taskList.appendChild(tempRow);
    
    const input = tempRow.querySelector('textarea');
    input.focus();
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline
            submitInlineTask(pIndex, tempRow);
        }
    });
}

function submitInlineTask(pIndex, rowElement) {
    const input = rowElement.querySelector('textarea');
    const val = input.value.trim();
    
    if (val) {
        appData.projects[pIndex].tasks.push({
            id: Date.now() + Math.random(),
            title: val,
            status: 'pending',
            timeSpent: 0,
            isActive: false,
            lastStartTime: null
        });
        saveData();
        render();
        // Re-open for rapid entry
        setTimeout(() => showInlineAddTask(pIndex), 50);
    } else {
        // If empty, just remove the row
        rowElement.remove();
    }
}

function showAddForm(prefillProject = '') {
    const form = document.getElementById('add-form-container');
    const btn = document.getElementById('btn-show-add');
    const projectInput = document.getElementById('new-project-input');
    const subtasksContainer = document.getElementById('new-subtasks-container');
    const datalist = document.getElementById('project-suggestions');

    // Populate suggestions
    datalist.innerHTML = '';
    const uniqueProjects = [...new Set(appData.projects.map(p => p.title).filter(t => t))];
    uniqueProjects.forEach(title => {
        const option = document.createElement('option');
        option.value = title;
        datalist.appendChild(option);
    });

    // Reset form
    projectInput.value = prefillProject;
    subtasksContainer.innerHTML = '';
    
    // Add initial 2 subtask inputs
    addSubTaskInput();
    addSubTaskInput();

    form.style.display = 'block';
    btn.style.display = 'none';
    
    if (prefillProject) {
        // Focus first subtask if project is prefilled
        const firstInput = subtasksContainer.querySelector('input');
        if(firstInput) firstInput.focus();
    } else {
        projectInput.focus();
    }
}

function cancelAddEntry() {
    document.getElementById('add-form-container').style.display = 'none';
    document.getElementById('btn-show-add').style.display = 'block';
}

function addSubTaskInput() {
    const container = document.getElementById('new-subtasks-container');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-form-input';
    input.style.marginBottom = '10px';
    input.placeholder = 'Sub task...';
    
    // Auto-add next input when typing
    input.addEventListener('input', function() {
        // If this is the last input and it has text, add another one
        if (this === container.lastElementChild && this.value.trim() !== '') {
            addSubTaskInput();
        }
    });

    // Handle Enter key to submit
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Move to next input or create new one
            const nextInput = this.nextElementSibling; // This might be null if structure is different
            // Actually structure is div > input. So next sibling of input is null.
            // We need to find the next input in the container.
            
            const allInputs = Array.from(container.querySelectorAll('input'));
            const index = allInputs.indexOf(this);
            
            if (index < allInputs.length - 1) {
                allInputs[index + 1].focus();
            } else {
                // Last one, create new
                addSubTaskInput();
                // Focus the new one (it's added async? no sync)
                const newInputs = container.querySelectorAll('input');
                newInputs[newInputs.length - 1].focus();
            }
        }
    });

    container.appendChild(input);
}

function submitNewEntry() {
    const projectInput = document.getElementById('new-project-input');
    const subtasksContainer = document.getElementById('new-subtasks-container');
    
    const projectTitle = projectInput.value.trim() || "General Tasks";
    const inputs = subtasksContainer.querySelectorAll('input');
    const newTasks = [];

    inputs.forEach(input => {
        const val = input.value.trim();
        if (val) {
            newTasks.push({
                id: Date.now() + Math.random(),
                title: val,
                status: 'pending',
                timeSpent: 0,
                isActive: false,
                lastStartTime: null
            });
        }
    });

    if (newTasks.length === 0 && !projectTitle) return;

    // Always create a new project block (User requested no merging)
    // If title is empty, default to "General Tasks"
    const finalTitle = projectTitle || "General Tasks";

    const project = {
        id: Date.now(),
        title: finalTitle,
        tasks: []
    };
    appData.projects.push(project);

    // Add tasks
    if (newTasks.length > 0) {
        project.tasks.push(...newTasks);
    } else {
        // Ensure at least one empty task if creating a new project with no tasks
        project.tasks.push({
            id: Date.now() + Math.random(),
            title: "",
            status: 'pending',
            timeSpent: 0,
            isActive: false,
            lastStartTime: null
        });
    }

    saveData();
    render();
    
    // Close the form and reset
    cancelAddEntry();
}

function updateProjectTitle(index, value) {

    appData.projects[index].title = value;
    saveData();
}

// Modal Logic
function showConfirmModal(title, message, action) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    pendingDeleteAction = action;
    document.getElementById('confirm-modal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    pendingDeleteAction = null;
}

function executeDelete() {
    if (pendingDeleteAction) {
        pendingDeleteAction();
        closeConfirmModal();
    }
}

function confirmDeleteAll() {
    showConfirmModal(
        'Delete All Tasks?',
        'This will remove ALL projects and tasks. This action cannot be undone.',
        () => {
            // Stop all timers
            Object.keys(timers).forEach(tid => {
                clearInterval(timers[tid]);
                delete timers[tid];
            });

            appData.projects = [];
            appData.date = new Date().toDateString();
            saveData();
            render();
        }
    );
}

function deleteProject(index) {
    showConfirmModal(
        'Delete Project?',
        `Are you sure you want to delete "${appData.projects[index].title}"?`,
        () => {
            // Stop any active timers in this project
            appData.projects[index].tasks.forEach(t => {
                if (timers[t.id]) {
                    clearInterval(timers[t.id]);
                    delete timers[t.id];
                }
            });

            appData.projects.splice(index, 1);
            if (appData.projects.length === 0) {
                appData.date = new Date().toDateString();
            }
            saveData();
            render();
        }
    );
}

function updateTaskTitle(pIndex, tIndex, value) {
    appData.projects[pIndex].tasks[tIndex].title = value;
    saveData();
}

function deleteTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    showConfirmModal(
        'Delete Task?',
        `Are you sure you want to delete "${task.title || 'this task'}"?`,
        () => {
            if (timers[task.id]) clearInterval(timers[task.id]);
            appData.projects[pIndex].tasks.splice(tIndex, 1);
            saveData();
            render();
        }
    );
}

function toggleTaskStatus(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    
    if (task.status === 'done') {
        task.status = 'pending';
    } else {
        stopTask(pIndex, tIndex); // Reuse stop logic
        return;
    }
    saveData();
    render();
}

// Timer Logic
function startTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    
    // Stop all other timers (Single focus mode)
    // We also need to update their state in appData so they don't resume on reload
    appData.projects.forEach(p => {
        p.tasks.forEach(t => {
            if (t.id !== task.id && t.isActive) {
                t.isActive = false;
                t.lastStartTime = null;
                if (timers[t.id]) {
                    clearInterval(timers[t.id]);
                    delete timers[t.id];
                }
            }
        });
    });

    // Update status
    task.status = 'in-progress';
    task.isActive = true;
    task.lastStartTime = Date.now();
    task.lastTimeSpent = task.timeSpent; // Store baseline
    
    saveData();
    render(); // Re-render to update icons

    runTimer(task);
}

function runTimer(task) {
    if (timers[task.id]) clearInterval(timers[task.id]);
    
    // Ensure lastTimeSpent is set (for restored tasks)
    if (task.lastTimeSpent === undefined) task.lastTimeSpent = task.timeSpent;

    timers[task.id] = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - task.lastStartTime) / 1000);
        task.timeSpent = task.lastTimeSpent + elapsed;
        
        // Update DOM directly for performance
        const badge = document.getElementById(`timer-${task.id}`);
        if (badge) badge.innerText = formatTime(task.timeSpent);
    }, 1000);
}

function pauseTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    if (timers[task.id]) {
        clearInterval(timers[task.id]);
        delete timers[task.id];
    }
    task.isActive = false;
    task.lastStartTime = null;
    // task.timeSpent is already updated by the interval loop
    saveData();
    render();
}

function stopTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    if (timers[task.id]) {
        clearInterval(timers[task.id]);
        delete timers[task.id];
    }
    task.isActive = false;
    task.lastStartTime = null;
    task.status = 'done';
    saveData();
    render();
}

function cancelTask(pIndex, tIndex) {
    const task = appData.projects[pIndex].tasks[tIndex];
    if (timers[task.id]) {
        clearInterval(timers[task.id]);
        delete timers[task.id];
    }
    task.isActive = false;
    task.lastStartTime = null;
    task.status = 'cancelled';
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
            
            // Colors: Done=Green, In-Progress=Yellow, Cancelled/Overdue=Red, Pending=Grey
            const isRunning = !!timers[t.id];
            let color = '#999'; // Default pending
            let icon = '•';

            if (t.status === 'done') {
                color = '#34c759'; // Green
                icon = '✓';
            } else if (t.status === 'in-progress' || isRunning) {
                color = '#ffcc00'; // Yellow
                icon = '▶';
            } else if (t.status === 'cancelled' || t.status === 'overdue') {
                color = '#ff3b30'; // Red
                icon = '✕';
            }
            
            listHtml += `
                <div style="display:flex; align-items: flex-start; font-size:0.9rem; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <span style="color:${color}; margin-right:8px; font-weight:bold; min-width: 15px;">${icon}</span>
                    <span style="flex-grow:1; color: #333; margin-right: 10px; word-break: break-word; text-align: left; ${t.status === 'cancelled' ? 'text-decoration:line-through; opacity:0.6;' : ''}">${t.title}</span>
                    <span style="font-family:monospace; color:#666; white-space: nowrap; min-width: 70px; text-align: right;">${formatTime(t.timeSpent)}</span>
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
    const originalElement = document.getElementById('report-preview-content');
    
    // Use html2canvas
    if (typeof html2canvas !== 'undefined') {
        // Clone the element to avoid modifying the visible one
        const clone = originalElement.cloneNode(true);
        
        // Style the clone to ensure full capture
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.width = '800px'; // Wider width
        clone.style.padding = '40px'; // More padding
        // clone.style.fontSize = '1.2rem'; // Removed global scaling to control elements individually
        clone.style.height = 'auto';
        clone.style.overflow = 'visible'; // Ensure no scrollbars
        clone.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'; // Ensure background is present
        
        // --- Modify Stats Section (Image Only) ---
        const total = clone.querySelector('#rep-total').innerText;
        const completed = clone.querySelector('#rep-completed').innerText;
        const time = clone.querySelector('#rep-time').innerText;
        const statsGrid = clone.querySelector('.report-stats-grid');
        
        // Compact Stats Layout
        statsGrid.style.display = 'flex';
        statsGrid.style.gap = '15px';
        statsGrid.style.marginBottom = '20px';
        statsGrid.innerHTML = `
            <div class="stat-item" style="flex: 1; padding: 8px; text-align: center; background: rgba(255,255,255,0.6); border-radius: 8px;">
                <span class="stat-number" style="font-size: 1.2rem; font-weight: 800; display: block;">${completed}/${total}</span>
                <span class="stat-label" style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.7;">Completed</span>
            </div>
            <div class="stat-item" style="flex: 1; padding: 8px; text-align: center; background: rgba(255,255,255,0.6); border-radius: 8px;">
                <span class="stat-number" style="font-size: 1.2rem; font-weight: 800; display: block;">${time}</span>
                <span class="stat-label" style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.7;">Focus Time</span>
            </div>
        `;

        // --- Modify Text Sizes (Image Only) ---
        // Project Titles
        const projectTitles = clone.querySelectorAll('#rep-list > div > div:first-child');
        projectTitles.forEach(el => {
            el.style.fontSize = '1.3rem'; // Slightly bigger than tasks
            el.style.marginBottom = '10px';
        });

        // Task Rows (Sub titles)
        const taskRows = clone.querySelectorAll('#rep-list > div > div:not(:first-child)');
        taskRows.forEach(el => {
            el.style.fontSize = '1.1rem'; // Increased size
            el.style.padding = '6px 0';
        });

        document.body.appendChild(clone);

        html2canvas(clone, {
            backgroundColor: null, // Transparent or inherit
            scale: 3, // High resolution
            logging: false,
            useCORS: true
        }).then(canvas => {
            document.body.removeChild(clone); // Clean up
            
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
        }).catch(err => {
            document.body.removeChild(clone);
            console.error(err);
            alert('Error generating image.');
        });
    } else {
        alert("Library loading... please wait or check internet connection.");
    }
}