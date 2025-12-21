import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersList = document.getElementById("users-list");
const usersTable = document.getElementById("users-table");
const loadingMessage = document.getElementById("loading-message");
const logoutBtn = document.getElementById("logout-btn");

// Lesson Form Elements
const createLessonForm = document.getElementById("create-lesson-form");
const addQuestionBtn = document.getElementById("add-question-btn");
const questionsContainer = document.getElementById("questions-container");

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
        usersList.innerHTML = ""; // Clear existing list
        
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

    } catch (error) {
        console.error("Error loading users:", error);
        loadingMessage.textContent = "Error loading users. Check console for details.";
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
    addQuestionInput();

    addQuestionBtn.addEventListener('click', addQuestionInput);

    createLessonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if(!confirm('Are you sure you want to publish this lesson?')) return;

        const title = document.getElementById('lesson-title').value;
        const category = document.getElementById('lesson-category').value;
        const difficulty = document.getElementById('lesson-difficulty').value;
        const reward = parseInt(document.getElementById('lesson-reward').value);
        const description = document.getElementById('lesson-description').value;
        const content = document.getElementById('lesson-content').value;

        // Gather Questions
        const questionBlocks = document.querySelectorAll('.question-block');
        const quiz = [];

        questionBlocks.forEach(block => {
            const qText = block.querySelector('.q-text').value;
            const opt1 = block.querySelector('.q-opt-1').value;
            const opt2 = block.querySelector('.q-opt-2').value;
            const opt3 = block.querySelector('.q-opt-3').value;
            const answer = parseInt(block.querySelector('.q-answer').value);

            quiz.push({
                question: qText,
                options: [opt1, opt2, opt3],
                answer: answer
            });
        });

        const newLesson = {
            title,
            category,
            difficulty,
            reward,
            description,
            content,
            quiz,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, 'lessons'), newLesson);
            alert('Lesson published successfully!');
            createLessonForm.reset();
            questionsContainer.innerHTML = '';
            addQuestionInput(); // Add one fresh question block
        } catch (error) {
            console.error('Error publishing lesson:', error);
            alert('Error publishing lesson: ' + error.message);
        }
    });
}

function addQuestionInput() {
    const qIndex = questionsContainer.children.length + 1;
    const div = document.createElement('div');
    div.className = 'question-block info-group';
    div.innerHTML = `
        <h4>Question ${qIndex}</h4>
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

