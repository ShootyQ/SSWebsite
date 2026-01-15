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

// Student Progress Modal Elements
const studentModal = document.getElementById("student-modal");
const closeStudentModal = document.getElementById("close-student-modal");
const studentName = document.getElementById("student-modal-name");
const studentBalance = document.getElementById("student-balance");
const studentNetWorth = document.getElementById("student-networth");
const studentCompletedCount = document.getElementById("student-completed-count");
const studentCompletedList = document.getElementById("student-completed-list");

// Lesson Stats Modal Elements
const lessonStatsModal = document.getElementById("lesson-stats-modal");
const closeLessonStatsModal = document.getElementById("close-lesson-stats-modal");
const lessonStatsTitle = document.getElementById("lesson-stats-title");
const lessonStatsCount = document.getElementById("lesson-stats-count");
const lessonStatsList = document.getElementById("lesson-stats-list");

let lessonsMap = {};
let usersMap = {};

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
        try {
            // Check if user is admin
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists() && userSnap.data().role === 'admin') {
                loadUsers();
                loadLessons();
                setupLessonForm();
                ensureCivicsLesson(); // Auto-seed the civics lesson
                ensureDepressionVocabLesson(); // Auto-seed the history vocab lesson
            } else {
                alert("Access Denied: You must be an admin to view this page.");
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Error verifying admin status:", error);
            alert("Error verifying permissions: " + error.message);
        }
    } else {
        window.location.href = "index.html";
    }
});

async function ensureCivicsLesson() {
    const lessonId = "vocab_lesson_civics_1";
    try {
        const docRef = doc(db, "lessons", lessonId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
             console.log("Seeding civics lesson...");
             await setDoc(docRef, {
                 title: "Civics & Economics Vocabulary",
                 description: "Master key vocabulary about government assistance, subsidies, and social safety nets.",
                 category: "civics",
                 difficulty: "easy",
                 reward: 150,
                 campaign: "Vocabulary Builders",
                 thumbnailUrl: "https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&q=80&w=300",
                 content: `
                    <h3>Key Terms</h3>
                    <p>Study these definitions carefully before taking the quiz!</p>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <ul style="line-height: 1.6; padding-left: 1.2rem;">
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Work relief</strong>: Government programs that give needy people jobs (instead of just cash handouts).</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Subsidy</strong>: Money the government gives to a person/company for an action the government wants (e.g., farmers reducing crops).</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Generate</strong>: To produce or make something exist (e.g., dams generate electricity).</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Pension</strong>: A regular payment to a person, usually after retirement.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Unemployment insurance</strong>: Government payments for a limited time to people who have lost their jobs.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Welfare</strong>: Help for people’s health, happiness, and basic comfort/safety (often through government support).</li>
                        </ul>
                    </div>
                 `,
                 quiz: [
                    {
                        question: "Which term describes government programs that provide jobs to needy people rather than just giving them cash?",
                        options: ["Work relief", "Welfare", "Unemployment insurance", "Subsidy"],
                        answer: 0,
                        type: "mc"
                    },
                    {
                        question: "Farmers receiving money from the government to reduce their crop production is an example of a:",
                        options: ["Pension", "Subsidy", "Tax break", "Tariff"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "To 'generate' something means to:",
                        options: ["Consume or use it up", "Produce or make it exist", "Regulate or control it", "Distribute or share it"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "What is a regular payment made to a person, typically after they have retired?",
                        options: ["Salary", "Pension", "Severance", "Bonus"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "If you lose your job, which government program might provide payments for a limited time?",
                        options: ["Social security", "Worker's compensation", "Unemployment insurance", "Welfare"],
                        answer: 2,
                        type: "mc"
                    },
                    {
                        question: "Which term broadly refers to help for people’s health, happiness, and basic comfort?",
                        options: ["Public works", "Welfare", "Infrastructure", "Insurance"],
                        answer: 1,
                        type: "mc"
                    }
                 ]
             });
             alert("New Civics Lesson has been added to the database!");
             loadLessons();
        }
    } catch(e) {
        console.error("Error seeding lesson", e);
    }
}

async function ensureDepressionVocabLesson() {
    const lessonId = "vocab_lesson_history_depression_1";
    try {
        const docRef = doc(db, "lessons", lessonId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
             console.log("Seeding history vocab lesson...");
             await setDoc(docRef, {
                 title: "The Great Depression: Key Vocabulary",
                 description: "Learn terms related to the causes and impact of the Great Depression, from market crashes to relief efforts.",
                 category: "history",
                 difficulty: "easy",
                 reward: 150,
                 campaign: "Vocabulary Builders",
                 thumbnailUrl: "https://images.unsplash.com/photo-1518182170546-0766ce6fec56?auto=format&fit=crop&q=80&w=300",
                 content: `
                    <h3>Key Terms</h3>
                    <p>Master these definitions to understand the economic challenges of the 1930s.</p>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <ul style="line-height: 1.6; padding-left: 1.2rem;">
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Invest</strong>: To commit money in hopes of making more money in the future.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Stock exchange</strong>: A place/system where shares in corporations are bought and sold through an organized market.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Decline</strong>: To drop or go down suddenly.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Collapse</strong>: A sudden fall or failure of something (like a structure or the value of money).</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Default</strong>: To fail to meet an obligation, especially a financial one.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Relief</strong>: Aid to the needy; welfare.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Public works</strong>: Projects built with public funds for public use (roads, parks, bridges, libraries, etc.).</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Buying on margin</strong>: Buying stock by paying part of the price and borrowing the rest; increases gains but also multiplies losses.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Hawley-Smoot Tariff</strong>: A tax on imported goods; other countries raised their own tariffs in response, which reduced trade and hurt businesses.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Reconstruction Finance Corporation (RFC)</strong>: Government agency that lent money to banks and businesses, but was criticized for not directly helping regular people enough.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Hoovervilles</strong>: Makeshift shantytowns of homeless people during the Depression, named to blame Hoover.</li>
                            <li style="margin-bottom: 0.5rem;"><strong style="color: #2c3e50;">Bonus Army</strong>: WWI veterans who marched on Washington, D.C., demanding early payment of promised bonuses.</li>
                        </ul>
                    </div>
                 `,
                 quiz: [
                    {
                        question: "What term describes buying stock by paying only part of the price and borrowing the rest?",
                        options: ["Invest", "Buying on margin", "Deficit spending", "Subsidy"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "What were the makeshift shantytowns of homeless people during the Depression called?",
                        options: ["Roosevelt Roads", "Hoovervilles", "Tent Cities", "Bonus Camps"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "A place or system where shares in corporations are bought and sold is called a:",
                        options: ["Public works", "Stock exchange", "Tariff", "Pension fund"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "When a person or organization fails to meet a financial obligation, they are said to:",
                        options: ["Invest", "Decline", "Default", "Collapse"],
                        answer: 2,
                        type: "mc"
                    },
                    {
                        question: "Which high tax on imported goods caused other countries to raise their own tariffs, hurting global trade?",
                        options: ["Hawley-Smoot Tariff", "Income Tax", "Sales Tax", "Property Tax"],
                        answer: 0,
                        type: "mc"
                    },
                    {
                        question: "Who were the 'Bonus Army'?",
                        options: ["Farmers demanding subsidies", "WWI veterans demanding early bonus payments", "Bankers asking for bailouts", "Construction workers on public projects"],
                        answer: 1,
                        type: "mc"
                    },
                    {
                        question: "Projects built with public funds for public use, like roads and parks, are known as:",
                        options: ["Public works", "Private equity", "Commercial real estate", "Industrial zones"],
                        answer: 0,
                        type: "mc"
                    },
                    {
                        question: "The Reconstruction Finance Corporation (RFC) was criticized for primarily helping:",
                        options: ["Homeless individuals", "Banks and businesses", "Farmers", "Veterans"],
                        answer: 1,
                        type: "mc"
                    }
                 ]
             });
             alert("New History Vocab Lesson has been added to the database!");
             loadLessons();
        }
    } catch(e) {
        console.error("Error seeding lesson", e);
    }
}

async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        usersList.innerHTML = ""; 
        usersMap = {};
        
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            usersMap[docSnap.id] = userData;

            const row = document.createElement("tr");
            
            let badgeClass = 'badge-student';
            if (userData.role === 'admin') badgeClass = 'badge-admin';
            else if (userData.role === 'guest') badgeClass = 'badge-secondary';

            let actionsHtml = `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">`;
            
            // View Progress Button
            actionsHtml += `<button class="btn-sm btn-view-progress" data-id="${docSnap.id}" style="background-color: #17a2b8; color: white;">View Progress</button>`;

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

        document.querySelectorAll('.btn-view-progress').forEach(btn => {
            btn.addEventListener('click', (e) => viewStudentProgress(e.target.dataset.id));
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
        lessonsMap = {};
        
        querySnapshot.forEach((docSnap) => {
            const lesson = docSnap.data();
            lessonsMap[docSnap.id] = lesson.title;

            const row = document.createElement("tr");
            
            row.innerHTML = `
                <td><strong>${lesson.title}</strong></td>
                <td>${lesson.campaign || '-'}</td>
                <td>${lesson.category}</td>
                <td>
                    <button class="btn-sm btn-view-stats" data-id="${docSnap.id}" style="background-color: #17a2b8; color: white; margin-right: 0.5rem;">Stats</button>
                    <button class="btn-sm btn-edit-lesson" data-id="${docSnap.id}">Edit</button>
                    <button class="btn-sm btn-danger btn-delete-lesson" data-id="${docSnap.id}">Delete</button>
                </td>
            `;
            
            lessonsList.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.btn-view-stats').forEach(btn => {
            btn.addEventListener('click', (e) => viewLessonStats(e.target.dataset.id));
        });
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

// Data Viewer Logic
function viewStudentProgress(userId) {
    const user = usersMap[userId];
    if (!user) return;

    studentName.textContent = user.displayName || user.email || "Unknown Student";
    studentBalance.textContent = `$${(user.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    studentNetWorth.textContent = `$${(user.netWorth || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    const completed = user.completedLessons || [];
    studentCompletedCount.textContent = completed.length;
    
    studentCompletedList.innerHTML = "";
    if (completed.length === 0) {
        studentCompletedList.innerHTML = "<li>No lessons completed yet.</li>";
    } else {
        completed.forEach(lessonId => {
            const title = lessonsMap[lessonId] || `Unknown Lesson (${lessonId})`;
            const li = document.createElement("li");
            li.textContent = title;
            studentCompletedList.appendChild(li);
        });
    }

    studentModal.style.display = "block";
}

function viewLessonStats(lessonId) {
    const lessonTitle = lessonsMap[lessonId] || "Unknown Lesson";
    lessonStatsTitle.textContent = lessonTitle;
    
    let count = 0;
    lessonStatsList.innerHTML = "";
    
    // usersMap is populated by loadUsers() which runs on init
    Object.values(usersMap).forEach(user => {
        if (user.completedLessons && user.completedLessons.includes(lessonId)) {
            count++;
            const li = document.createElement("li");
            li.textContent = user.displayName || user.email || "Unknown User";
            lessonStatsList.appendChild(li);
        }
    });
    
    if (count === 0) {
        lessonStatsList.innerHTML = "<li>No students have completed this lesson yet.</li>";
    }
    
    lessonStatsCount.textContent = count;
    lessonStatsModal.style.display = "block";
}

// Modal Events
if(closeStudentModal) {
    closeStudentModal.onclick = () => studentModal.style.display = "none";
}
if(closeLessonStatsModal) {
    closeLessonStatsModal.onclick = () => lessonStatsModal.style.display = "none";
}

window.onclick = (e) => {
    if (e.target === studentModal) studentModal.style.display = "none";
    if (e.target === lessonStatsModal) lessonStatsModal.style.display = "none";
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

