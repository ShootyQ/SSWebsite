import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersList = document.getElementById("users-list");
const usersTable = document.getElementById("users-table");
const loadingMessage = document.getElementById("loading-message");
const logoutBtn = document.getElementById("logout-btn");

// Lesson Form Elements
const createLessonForm = document.getElementById("create-lesson-form");
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
            
            row.innerHTML = `
                <td>
                    <div class="user-info">
                        ${userData.photoURL ? `<img src="${userData.photoURL}" alt="Profile" class="user-thumb">` : ''}
                        <span>${userData.displayName || 'No Name'}</span>
                    </div>
                </td>
                <td>${userData.email}</td>
                <td>
                    <span class="badge ${userData.role === 'admin' ? 'badge-admin' : 'badge-student'}">
                        ${userData.role}
                    </span>
                </td>
                <td>
                    ${userData.role === 'student' 
                        ? `<button class="btn-sm btn-make-admin" data-id="${docSnap.id}">Make Admin</button>` 
                        : `<button class="btn-sm btn-make-student" data-id="${docSnap.id}">Make Student</button>`
                    }
                </td>
            `;
            
            usersList.appendChild(row);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.btn-make-admin').forEach(btn => {
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
        
        if(!confirm('Are you sure you want to publish this lesson?')) return;

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

        const newLesson = {
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
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, 'lessons'), newLesson);
            alert('Lesson published successfully!');
            createLessonForm.reset();
            questionsContainer.innerHTML = '';
            addMcInput(); 
        } catch (error) {
            console.error('Error publishing lesson:', error);
            alert('Error publishing lesson: ' + error.message);
        }
    });
}

function addMcInput() {
    const qIndex = questionsContainer.children.length + 1;
    const div = document.createElement('div');
    div.className = 'question-block info-group';
    div.dataset.type = 'mc';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
            <h4>Q${qIndex}: Multiple Choice</h4>
            <button type="button" class="btn-sm btn-danger" onclick="this.closest('.question-block').remove()">Remove</button>
        </div>
        <div class='form-group'>
            <label>Question Text</label>
            <input type='text' class='q-text' required placeholder='e.g., What is a stock?'>
        </div>
        <div class='form-group'>
            <label>Option 1</label>
            <input type='text' class='q-opt-1' required placeholder='Option 1'>
        </div>
        <div class='form-group'>
            <label>Option 2</label>
            <input type='text' class='q-opt-2' required placeholder='Option 2'>
        </div>
        <div class='form-group'>
            <label>Option 3</label>
            <input type='text' class='q-opt-3' required placeholder='Option 3'>
        </div>
        <div class='form-group'>
            <label>Correct Answer</label>
            <select class='q-answer' required>
                <option value='0'>Option 1</option>
                <option value='1'>Option 2</option>
                <option value='2'>Option 3</option>
            </select>
        </div>
    `;
    questionsContainer.appendChild(div);
}

function addOrderInput() {
    const qIndex = questionsContainer.children.length + 1;
    const div = document.createElement('div');
    div.className = 'question-block info-group';
    div.dataset.type = 'order';
    div.style.borderLeft = "4px solid #9c27b0"; // Color code specifically for drag drop
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
             <h4>Q${qIndex}: Drag & Drop Order</h4>
             <button type="button" class="btn-sm btn-danger" onclick="this.closest('.question-block').remove()">Remove</button>
        </div>
        <div class='form-group'>
            <label>Question / Instruction</label>
            <input type='text' class='q-text' required placeholder='e.g., Arrange these events chronologically'>
        </div>
        <div class='form-group'>
            <label>Correct Order (Comma Separated)</label>
            <textarea class='q-items' rows="3" required placeholder='Event 1, Event 2, Event 3 (The system will shuffle these for the student)'></textarea>
        </div>
    `;
    questionsContainer.appendChild(div);
}

