import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersList = document.getElementById("users-list");
const usersTable = document.getElementById("users-table");
const loadingMessage = document.getElementById("loading-message");
const logoutBtn = document.getElementById("logout-btn");

// Lessons List Elements
const lessonsList = document.getElementById("lessons-list");
const lessonsTable = document.getElementById("lessons-table");
const loadingLessons = document.getElementById("loading-lessons");

// Lesson Form Elements
const createLessonForm = document.getElementById("create-lesson-form");
const formTitle = document.getElementById("form-title");
const editLessonIdInput = document.getElementById("edit-lesson-id");
const addMcBtn = document.getElementById("add-mc-btn");
const addOrderBtn = document.getElementById("add-order-btn");
const questionsContainer = document.getElementById("questions-container");
const resetClassGoalBtn = document.getElementById("reset-class-goal-btn");

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "index.html";
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });
}

// Check Admin Status and Load Data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check if user is admin
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            loadUsers();
            loadLessons();
            setupLessonForm();
        } else {
            alert("Access Denied: You must be an admin to view this page.");
            window.location.href = "index.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        // Existing user loading logic... (omitted for brevity, assume unchanged logic here if I could)
        // Re-read file to be safe, but I will just paste the content I know is there 
        usersList.innerHTML = ""; 
        
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            const row = document.createElement("tr");
            
            let badgeClass = 'badge-student';
            if (userData.role === 'admin') badgeClass = 'badge-admin';
            else if (userData.role === 'guest') badgeClass = 'badge-secondary';

            let actionsHtml = `<div style="display: flex; gap: 0.5rem;">`;
            
            // Render buttons for roles that are NOT the current role
            if (userData.role !== 'guest') {
                actionsHtml += `<button class="btn-sm btn-role-change" data-id="${docSnap.id}" data-role="guest" style="background-color: #6c757d; color: white;">Make Guest</button>`;
            }
            if (userData.role !== 'student') {
                actionsHtml += `<button class="btn-sm btn-role-change" data-id="${docSnap.id}" data-role="student" style="background-color: #28a745; color: white;">Make Student</button>`;
            }
            if (userData.role !== 'admin') {
                actionsHtml += `<button class="btn-sm btn-role-change" data-id="${docSnap.id}" data-role="admin" style="background-color: #007bff; color: white;">Make Admin</button>`;
            }

            actionsHtml += `</div>`;

            row.innerHTML = `
                <td>
                    <div class="user-info">
                        ${userData.photoURL ? `<img src="${userData.photoURL}" alt="Profile" class="user-thumb">` : ''}
                        <span>${userData.displayName || 'No Name'}</span>
                    </div>
                </td>
                <td>${userData.email}</td>
                <td>
                    <span class="badge ${badgeClass}">
                        ${userData.role}
                    </span>
                </td>
                <td>
                    ${actionsHtml}
                </td>
            `;
            
            usersList.appendChild(row);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.btn-role-change').forEach(btn => {
            btn.addEventListener('click', (e) => updateUserRole(e.target.dataset.id, e.target.dataset.role));
        });
            btn.addEventListener('click', (e) => updateUserRole(e.target.dataset.id, 'admin'));
        });
        document.querySelectorAll('.btn-make-student').forEach(btn => {
            btn.addEventListener('click', (e) => updateUserRole(e.target.dataset.id, 'student'));
        });

        loadingMessage.style.display = "none";
        usersTable.style.display = "table";
        
        // Also Load Campaigns for Autocomplete
        loadCampaigns();

    } catch (error) {
        console.error("Error loading users:", error);
        loadingMessage.textContent = "Error loading users. View console.";
    }
}

async function loadLessons() {
    try {
        const querySnapshot = await getDocs(collection(db, "lessons"));
        lessonsList.innerHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const lesson = docSnap.data();
            const row = document.createElement("tr");
            
            row.innerHTML = `
                <td><strong>${lesson.title}</strong></td>
                <td>${lesson.campaign || '-'}</td>
                <td>${lesson.category}</td>
                <td>
                    <button class="btn-sm btn-edit-lesson" data-id="${docSnap.id}">Edit</button>
                    <button class="btn-sm btn-danger btn-delete-lesson" data-id="${docSnap.id}">Delete</button>
                </td>
            `;
            
            lessonsList.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.btn-edit-lesson').forEach(btn => {
            btn.addEventListener('click', (e) => editLesson(e.target.dataset.id));
        });
        document.querySelectorAll('.btn-delete-lesson').forEach(btn => {
            btn.addEventListener('click', (e) => deleteLesson(e.target.dataset.id));
        });

        loadingLessons.style.display = "none";
        lessonsTable.style.display = "table";

    } catch (error) {
        console.error("Error loading lessons:", error);
        loadingLessons.textContent = "Error loading lessons.";
    }
}

async function deleteLesson(id) {
    if(!confirm("Are you sure you want to delete this lesson? This cannot be undone.")) return;
    
    try {
        await deleteDoc(doc(db, "lessons", id));
        loadLessons(); // Refresh list
    } catch(e) {
        console.error("Error deleting lesson:", e);
        alert("Failed to delete lesson");
    }
}

async function editLesson(id) {
    try {
        const docSnap = await getDoc(doc(db, "lessons", id));
        if (!docSnap.exists()) {
            alert("Lesson not found!");
            return;
        }
        
        const lesson = docSnap.data();
        
        // Populate Form
        document.getElementById('edit-lesson-id').value = id;
        formTitle.innerText = "Edit Lesson";
        
        document.getElementById('lesson-title').value = lesson.title;
        document.getElementById('lesson-campaign').value = lesson.campaign || "";
        
        const catSelect = document.getElementById('lesson-category');
        if(['basics', 'strategy', 'economics', 'history'].includes(lesson.category)) {
            catSelect.value = lesson.category;
            document.getElementById('lesson-category-custom').style.display = 'none';
        } else {
            catSelect.value = 'other';
            const catCustom = document.getElementById('lesson-category-custom');
            catCustom.style.display = 'block';
            catCustom.value = lesson.category;
        }
        
        document.getElementById('lesson-difficulty').value = lesson.difficulty;
        document.getElementById('lesson-reward').value = lesson.reward;
        document.getElementById('lesson-description').value = lesson.description;
        document.getElementById('lesson-content').value = lesson.content;
        document.getElementById('lesson-video').value = lesson.videoUrl || "";
        document.getElementById('lesson-thumbnail').value = lesson.thumbnailUrl || "";
        
        // Clear and Rebuild Questions
        questionsContainer.innerHTML = "";
        if (lesson.quiz && lesson.quiz.length > 0) {
            lesson.quiz.forEach(q => {
                if (q.type === 'mc') {
                    addMcInput(q);
                } else if (q.type === 'order') {
                    addOrderInput(q);
                }
            });
        } else {
            addMcInput(); // Add one default if none exist
        }

        // Scroll to form
        createLessonForm.scrollIntoView({ behavior: 'smooth' });

        // Add Cancel Edit Button if not exists
        let cancelBtn = document.getElementById('cancel-edit-btn');
        if(!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-secondary';
            cancelBtn.style.marginLeft = '1rem';
            cancelBtn.innerText = 'Cancel Edit';
            cancelBtn.addEventListener('click', resetForm);
            createLessonForm.querySelector('button[type="submit"]').after(cancelBtn);
        }

    } catch(e) {
        console.error("Error loading lesson for edit:", e);
        alert("Error loading lesson details.");
    }
}

function resetForm() {
    createLessonForm.reset();
    document.getElementById('edit-lesson-id').value = "";
    formTitle.innerText = "Create New Lesson";
    questionsContainer.innerHTML = "";
    addMcInput();
    
    // Remove custom category input display
    document.getElementById('lesson-category-custom').style.display = 'none';
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if(cancelBtn) cancelBtn.remove();
}


async function loadCampaigns() {
    try {
        const querySnapshot = await getDocs(collection(db, "lessons"));
        const campaigns = new Set();
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if(data.campaign) campaigns.add(data.campaign);
        });
        
        const datalist = document.getElementById("campaign-suggestions");
        datalist.innerHTML = "";
        campaigns.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            datalist.appendChild(opt);
        });
    } catch(e) {
        console.error("Error loading campaigns", e);
    }
}

async function updateUserRole(userId, newRole) {
    if(!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            role: newRole
        });
        // Reload list to reflect changes
        loadUsers();
    } catch (error) {
        console.error("Error updating role:", error);
        alert("Failed to update role: " + error.message);
    }
}

// --- Lesson Creation Logic ---

function setupLessonForm() {
    // Add one initial question
    addMcInput();

    addMcBtn.addEventListener('click', addMcInput);
    addOrderBtn.addEventListener('click', addOrderInput);
    
    // Reset Goal
    if(resetClassGoalBtn) {
        resetClassGoalBtn.addEventListener('click', async () => {
             if(confirm("Are you sure you want to reset the class total lesson count to 0?")) {
                 try {
                     const sysRef = doc(db, "system", "gamestate");
                     await setDoc(sysRef, { totalLessonsCompleted: 0 }, { merge: true });
                     alert("Class goal reset!");
                 } catch(e) {
                     console.error("Error resetting goal", e);
                 }
             }
        });
    }

    // Custom Category Toggle
    const catSelect = document.getElementById('lesson-category');
    const catCustom = document.getElementById('lesson-category-custom');
    
    catSelect.addEventListener('change', (e) => {
        if(e.target.value === 'other') {
            catCustom.style.display = 'block';
            catCustom.required = true;
        } else {
            catCustom.style.display = 'none';
            catCustom.required = false;
        }
    });

    createLessonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Check for edit mode
        const editId = document.getElementById('edit-lesson-id').value;
        const isEdit = !!editId;
        const confirmMsg = isEdit ? 'Are you sure you want to update this lesson?' : 'Are you sure you want to publish this lesson?';

        if(!confirm(confirmMsg)) return;

        const title = document.getElementById('lesson-title').value;
        let category = document.getElementById('lesson-category').value;
        if(category === 'other') {
            category = document.getElementById('lesson-category-custom').value;
        }
        const campaign = document.getElementById('lesson-campaign').value || "General";

        const difficulty = document.getElementById('lesson-difficulty').value;
        const reward = parseInt(document.getElementById('lesson-reward').value);
        const description = document.getElementById('lesson-description').value;
        const content = document.getElementById('lesson-content').value;

        // Handle Video URL
        const videoInput = document.getElementById('lesson-video').value;
        let videoUrl = videoInput;
        if (videoUrl && videoUrl.includes("youtube.com/watch")) {
            const urlParams = new URLSearchParams(new URL(videoUrl).search);
            if (urlParams.has('v')) {
                videoUrl = `https://www.youtube.com/embed/${urlParams.get('v')}`;
            }
        } else if (videoUrl && videoUrl.includes("youtu.be/")) {
             const parts = videoUrl.split("/");
             const id = parts[parts.length - 1].split("?")[0];
             videoUrl = `https://www.youtube.com/embed/${id}`;
        }

        const thumbnailUrl = document.getElementById('lesson-thumbnail').value;

        // Gather Questions
        const questionBlocks = document.querySelectorAll('.question-block');
        const quiz = [];

        questionBlocks.forEach(block => {
            const type = block.dataset.type || 'mc';
            const qText = block.querySelector('.q-text').value;

            if (type === 'mc') {
                const opt1 = block.querySelector('.q-opt-1').value;
                const opt2 = block.querySelector('.q-opt-2').value;
                const opt3 = block.querySelector('.q-opt-3').value;
                const answer = parseInt(block.querySelector('.q-answer').value);
                quiz.push({
                    type: 'mc',
                    question: qText,
                    options: [opt1, opt2, opt3],
                    answer: answer
                });
            } else if (type === 'order') {
                const itemsStr = block.querySelector('.q-items').value;
                // Items entered as comma separated list in CORRECT order
                const items = itemsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
                
                quiz.push({
                    type: 'order',
                    question: qText,
                    correctOrder: items // This is the source of truth
                });
            }
        });

        const lessonData = {
            title,
            category,
            campaign,
            difficulty,
            reward,
            description,
            content,
            videoUrl,
            thumbnailUrl,
            quiz,
            updatedAt: new Date().toISOString()
        };
        
        if (!isEdit) {
            lessonData.createdAt = new Date().toISOString();
        }

        try {
            if (isEdit) {
                await setDoc(doc(db, 'lessons', editId), lessonData, { merge: true });
                alert('Lesson updated successfully!');
                resetForm();
            } else {
                await addDoc(collection(db, 'lessons'), lessonData);
                alert('Lesson published successfully!');
                createLessonForm.reset();
                questionsContainer.innerHTML = '';
                addMcInput(); 
            }
            loadLessons(); // Refresh list
        } catch (error) {
            console.error('Error saving lesson:', error);
            alert('Error saving lesson: ' + error.message);
        }
    });
}

function addMcInput(data = null) {
    const qIndex = questionsContainer.children.length + 1;
    const div = document.createElement('div');
    div.className = 'question-block info-group';
    div.dataset.type = 'mc';
    
    // Default values
    let qText = '', opt1 = '', opt2 = '', opt3 = '', ans = '0';
    if(data) {
        qText = data.question;
        opt1 = data.options[0];
        opt2 = data.options[1];
        opt3 = data.options[2];
        ans = data.answer;
    }

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
            <h4>Q${qIndex}: Multiple Choice</h4>
            <button type="button" class="btn-sm btn-danger" onclick="this.closest('.question-block').remove()">Remove</button>
        </div>
        <div class='form-group'>
            <label>Question Text</label>
            <input type='text' class='q-text' required placeholder='e.g., What is a stock?' value="${qText}">
        </div>
        <div class='form-group'>
            <label>Option 1</label>
            <input type='text' class='q-opt-1' required placeholder='Option 1' value="${opt1}">
        </div>
        <div class='form-group'>
            <label>Option 2</label>
            <input type='text' class='q-opt-2' required placeholder='Option 2' value="${opt2}">
        </div>
        <div class='form-group'>
            <label>Option 3</label>
            <input type='text' class='q-opt-3' required placeholder='Option 3' value="${opt3}">
        </div>
        <div class='form-group'>
            <label>Correct Answer</label>
            <select class='q-answer' required>
                <option value='0' ${ans == 0 ? 'selected' : ''}>Option 1</option>
                <option value='1' ${ans == 1 ? 'selected' : ''}>Option 2</option>
                <option value='2' ${ans == 2 ? 'selected' : ''}>Option 3</option>
            </select>
        </div>
    `;
    questionsContainer.appendChild(div);
}

function addOrderInput(data = null) {
    const qIndex = questionsContainer.children.length + 1;
    const div = document.createElement('div');
    div.className = 'question-block info-group';
    div.dataset.type = 'order';
    div.style.borderLeft = "4px solid #9c27b0"; // Color code specifically for drag drop
    
    let qText = '', correctOrderStr = '';
    if(data) {
        qText = data.question;
        correctOrderStr = data.correctOrder.join(', ');
    }

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
             <h4>Q${qIndex}: Drag & Drop Order</h4>
             <button type="button" class="btn-sm btn-danger" onclick="this.closest('.question-block').remove()">Remove</button>
        </div>
        <div class='form-group'>
            <label>Question / Instruction</label>
            <input type='text' class='q-text' required placeholder='e.g., Arrange these events chronologically' value="${qText}">
        </div>
        <div class='form-group'>
            <label>Correct Order (Comma Separated)</label>
            <textarea class='q-items' rows="3" required placeholder='Event 1, Event 2, Event 3'>${correctOrderStr}</textarea>
        </div>
    `;
    questionsContainer.appendChild(div);
}

