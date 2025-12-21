import { auth, db } from "./firebase-config.js";
import { generateLoot } from "./game_data.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, increment, runTransaction, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Data ---
let LESSONS = [];

// --- DOM Elements ---
const els = {
    grid: document.getElementById('lessons-grid'),
    search: document.getElementById('lesson-search'),
    catFilter: document.getElementById('category-filter'),
    diffFilter: document.getElementById('difficulty-filter'),
    modal: document.getElementById('lesson-modal'),
    closeModal: document.getElementById('close-lesson-modal'),
    
    // Modal Elements
    mTitle: document.getElementById('modal-title'),
    mCategory: document.getElementById('modal-category'),
    mDifficulty: document.getElementById('modal-difficulty'),
    mReward: document.getElementById('modal-reward'),
    mContent: document.getElementById('modal-content'),
    mQuiz: document.getElementById('quiz-container'),
    mSubmit: document.getElementById('submit-quiz-btn'),
    mFeedback: document.getElementById('quiz-feedback'),
    
    // Progress
    progressContainer: document.getElementById('user-lesson-progress'),
    progressCount: document.getElementById('completed-count'),
    progressFill: document.getElementById('lesson-progress-fill')
};

let currentUser = null;
let userData = null;
let currentLesson = null;

// --- Init ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await Promise.all([loadUserData(), fetchLessons()]);
        renderLessons();
    } else {
        window.location.href = "index.html";
    }
});

async function fetchLessons() {
    try {
        const querySnapshot = await getDocs(collection(db, "lessons"));
        LESSONS = [];
        querySnapshot.forEach((doc) => {
            LESSONS.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("Error fetching lessons:", error);
        els.grid.innerHTML = '<div class="error">Failed to load lessons. Please try again later.</div>';
    }
}

async function loadUserData() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (docSnap.exists()) {
        userData = docSnap.data();
        updateProgress();
    }
}

function updateProgress() {
    const completed = userData.completedLessons || [];
    els.progressContainer.style.display = 'block';
    els.progressCount.textContent = completed.length;
    
    const pct = LESSONS.length > 0 ? Math.min(100, (completed.length / LESSONS.length) * 100) : 0;
    els.progressFill.style.width = `${pct}%`;
}

// --- Rendering ---
function renderLessons() {
    const searchTerm = els.search.value.toLowerCase();
    const catFilter = els.catFilter.value;
    const diffFilter = els.diffFilter.value;
    const completed = userData.completedLessons || [];

    els.grid.innerHTML = '';

    let filtered = LESSONS.filter(lesson => {
        const matchesSearch = lesson.title.toLowerCase().includes(searchTerm) || 
                              lesson.description.toLowerCase().includes(searchTerm);
        const matchesCat = catFilter === 'all' || lesson.category === catFilter;
        const matchesDiff = diffFilter === 'all' || lesson.difficulty === diffFilter;
        return matchesSearch && matchesCat && matchesDiff;
    });

    // Sort: Pending first, then Completed
    filtered.sort((a, b) => {
        const aCompleted = completed.includes(a.id);
        const bCompleted = completed.includes(b.id);
        if (aCompleted === bCompleted) return 0;
        return aCompleted ? 1 : -1; // If a is completed, it goes after b (pending)
    });

    if (filtered.length === 0) {
        els.grid.innerHTML = '<div class="no-results">No lessons found matching your criteria.</div>';
        return;
    }

    filtered.forEach(lesson => {
        const isCompleted = completed.includes(lesson.id);
        const card = document.createElement('div');
        card.className = `lesson-card ${isCompleted ? 'completed' : ''}`;
        card.onclick = () => openLesson(lesson);

        card.innerHTML = `
            <div class="lesson-card-header">
                <span class="badge-tag ${lesson.category}">${lesson.category}</span>
                ${isCompleted ? '<span class="status-icon">✅</span>' : ''}
            </div>
            <h3>${lesson.title}</h3>
            <p>${lesson.description}</p>
            <div class="lesson-card-footer">
                <span class="difficulty ${lesson.difficulty}">${lesson.difficulty}</span>
                <span class="reward">💰 ${lesson.reward}</span>
            </div>
        `;
        els.grid.appendChild(card);
    });
}

// --- Modal Logic ---
function openLesson(lesson) {
    currentLesson = lesson;
    const isCompleted = (userData.completedLessons || []).includes(lesson.id);

    els.mTitle.textContent = lesson.title;
    els.mCategory.textContent = lesson.category.toUpperCase();
    els.mCategory.className = `badge-tag ${lesson.category}`;
    els.mDifficulty.textContent = lesson.difficulty.toUpperCase();
    els.mReward.textContent = lesson.reward;
    els.mContent.innerHTML = lesson.content;
    
    // Render Quiz
    els.mQuiz.innerHTML = '';
    els.mFeedback.style.display = 'none';
    els.mFeedback.className = 'quiz-feedback';
    
    if (lesson.quiz && lesson.quiz.length > 0) {
        lesson.quiz.forEach((q, index) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'quiz-question';
            qDiv.innerHTML = `
                <p><strong>Q${index + 1}:</strong> ${q.question}</p>
                <div class="quiz-options">
                    ${q.options.map((opt, i) => `
                        <label class="quiz-option">
                            <input type="radio" name="q${index}" value="${i}">
                            ${opt}
                        </label>
                    `).join('')}
                </div>
            `;
            els.mQuiz.appendChild(qDiv);
        });
        els.mQuiz.style.display = 'block';
        els.mSubmit.style.display = 'block';
    } else {
        els.mQuiz.style.display = 'none';
        els.mSubmit.style.display = 'none';
    }

    // Button State
    if (isCompleted) {
        els.mSubmit.textContent = "Lesson Completed ✅";
        els.mSubmit.disabled = true;
    } else {
        els.mSubmit.textContent = "Submit Answers & Claim Reward";
        els.mSubmit.disabled = false;
    }

    els.modal.style.display = 'flex';
}

els.mSubmit.addEventListener('click', async () => {
    if (!currentLesson) return;

    // Validate Answers
    let correctCount = 0;
    let allAnswered = true;

    currentLesson.quiz.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        if (!selected) {
            allAnswered = false;
        } else if (parseInt(selected.value) === parseInt(q.answer)) {
            correctCount++;
        }
    });

    if (!allAnswered) {
        alert("Please answer all questions!");
        return;
    }

    if (correctCount === currentLesson.quiz.length) {
        // Success!
        await completeLesson(currentLesson);
    } else {
        // Fail
        els.mFeedback.textContent = `You got ${correctCount}/${currentLesson.quiz.length} correct. Try again!`;
        els.mFeedback.classList.add('error');
        els.mFeedback.style.display = 'block';
    }
});

async function completeLesson(lesson) {
    els.mSubmit.disabled = true;
    els.mSubmit.textContent = "Processing...";

    try {
        // Generate Loot (Lesson specific)
        const lootItem = generateLoot(null, 'lesson');
        let lootMessage = "";

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User error";

            const data = userDoc.data();
            const completed = data.completedLessons || [];

            if (completed.includes(lesson.id)) {
                throw "Already completed";
            }

            const updates = {
                balance: (data.balance || 0) + lesson.reward,
                netWorth: (data.netWorth || 0) + lesson.reward, // Update net worth too
                completedLessons: arrayUnion(lesson.id)
            };

            if (lootItem) {
                updates.inventory = arrayUnion(lootItem);
                lootMessage = `\n\nYou also found: ${lootItem.name} (${lootItem.rarity})!`;
            }

            transaction.update(userRef, updates);
        });

        // UI Success
        els.mFeedback.textContent = `Correct! You earned $${lesson.reward}!${lootMessage}`;
        els.mFeedback.classList.remove('error');
        els.mFeedback.classList.add('success');
        els.mFeedback.style.display = 'block';
        els.mSubmit.textContent = "Lesson Completed ✅";
        
        // Refresh Data
        await loadUserData();
        renderLessons();

    } catch (err) {
        console.error(err);
        if (err === "Already completed") {
            alert("You have already completed this lesson.");
        } else {
            alert("Error completing lesson. Please try again.");
            els.mSubmit.disabled = false;
        }
    }
}

// --- Event Listeners ---
els.closeModal.addEventListener('click', () => els.modal.style.display = 'none');
window.onclick = (e) => { if (e.target === els.modal) els.modal.style.display = 'none'; };

els.search.addEventListener('input', renderLessons);
els.catFilter.addEventListener('change', renderLessons);
els.diffFilter.addEventListener('change', renderLessons);
