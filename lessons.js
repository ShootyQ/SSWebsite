import { auth, db } from "./firebase-config.js";
import { generateLoot } from "./game_data.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, increment, runTransaction, collection, getDocs, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    
    // Class Goal
    goalFill: document.getElementById('class-goal-fill'),
    goalCounter: document.getElementById('class-goal-counter'),
    
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
        await loadUserData();
        
        if (userData && userData.role === 'guest') {
            alert("Your account is pending approval. Please contact your teacher.");
            window.location.href = "index.html";
            return;
        }

        await fetchLessons();
        renderLessons();
        listenToClassGoal();
    } else {
        window.location.href = "index.html";
    }
});

function listenToClassGoal() {
    onSnapshot(doc(db, "system", "gamestate"), (doc) => {
        if(doc.exists()) {
             const data = doc.data();
             const total = data.totalLessonsCompleted || 0;
             const target = 500;
             const pct = Math.min(100, (total / target) * 100);
             
             if(els.goalFill) els.goalFill.style.width = `${pct}%`;
             if(els.goalCounter) els.goalCounter.textContent = `${total} / ${target} Lessons`;
        }
    });
}

async function fetchLessons() {
    try {
        const querySnapshot = await getDocs(collection(db, "lessons"));
        LESSONS = [];
        querySnapshot.forEach((doc) => {
            LESSONS.push({ id: doc.id, ...doc.data() });
        });

        // Added Lesson: Civics/Economics Vocab
        LESSONS.push({
             id: "vocab_lesson_civics_1",
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
                    answer: 0
                },
                {
                    question: "Farmers receiving money from the government to reduce their crop production is an example of a:",
                    options: ["Pension", "Subsidy", "Tax break", "Tariff"],
                    answer: 1
                },
                {
                    question: "To 'generate' something means to:",
                    options: ["Consume or use it up", "Produce or make it exist", "Regulate or control it", "Distribute or share it"],
                    answer: 1
                },
                {
                    question: "What is a regular payment made to a person, typically after they have retired?",
                    options: ["Salary", "Pension", "Severance", "Bonus"],
                    answer: 1
                },
                {
                    question: "If you lose your job, which government program might provide payments for a limited time?",
                    options: ["Social security", "Worker's compensation", "Unemployment insurance", "Welfare"],
                    answer: 2
                },
                {
                    question: "Which term broadly refers to help for people’s health, happiness, and basic comfort?",
                    options: ["Public works", "Welfare", "Infrastructure", "Insurance"],
                    answer: 1
                }
             ]
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

    if (filtered.length === 0) {
        els.grid.innerHTML = '<div class="no-results">No lessons found matching your criteria.</div>';
        return;
    }

    // Group by Campaign
    const campaigns = {};
    filtered.forEach(lesson => {
        const cName = lesson.campaign || "General Lessons";
        if (!campaigns[cName]) campaigns[cName] = [];
        campaigns[cName].push(lesson);
    });

    // Render Campaigns
    for (const [campaignName, campaignLessons] of Object.entries(campaigns)) {
        // Sort lessons inside campaign (Simple alphabet sort for now, ideally strictly ordered)
        // Or if 'order' field exists. For now, assume creation order or alphabetical?
        // Let's sort completed last inside the campaign row
        campaignLessons.sort((a, b) => {
            const aCompleted = completed.includes(a.id);
            const bCompleted = completed.includes(b.id);
            if (aCompleted === bCompleted) return 0;
            return aCompleted ? 1 : -1;
        });

        // Campaign Header
        const campaignHeader = document.createElement('div');
        campaignHeader.className = 'campaign-header';
        campaignHeader.style.gridColumn = "1 / -1";
        campaignHeader.style.marginTop = "1.5rem";
        campaignHeader.style.borderBottom = "2px solid #eee";
        campaignHeader.innerHTML = `<h3 style="margin-bottom:0.5rem; color:#2c3e50;">📌 ${campaignName}</h3>`;
        els.grid.appendChild(campaignHeader);

        // Render Lessons for this campaign
        campaignLessons.forEach(lesson => {
            const isCompleted = completed.includes(lesson.id);
            const card = document.createElement('div');
            card.className = `lesson-card ${isCompleted ? 'completed' : ''}`;
            card.onclick = () => openLesson(lesson);

            card.innerHTML = `
                ${lesson.thumbnailUrl ? `<div class="lesson-thumbnail" style="background-image: url('${lesson.thumbnailUrl}'); height: 140px; background-size: cover; background-position: center; border-radius: 8px 8px 0 0;"></div>` : ''}
                <div class="lesson-card-header" ${lesson.thumbnailUrl ? 'style="border-radius: 0;"' : ''}>
                    <span class="badge-tag ${lesson.category}">${lesson.category}</span>
                    ${isCompleted ? '<span class="status-icon">✅</span>' : ''}
                </div>
                <div style="padding: 1rem;">
                    <h3 style="margin-top: 0;">${lesson.title}</h3>
                    <p>${lesson.description}</p>
                    <div class="lesson-card-footer">
                        <span class="difficulty ${lesson.difficulty}">${lesson.difficulty}</span>
                        <span class="reward">💰 ${lesson.reward}</span>
                    </div>
                </div>
            `;
            els.grid.appendChild(card);
        });
    }
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
    
    // Video Embed
    let contentHtml = "";
    if (lesson.videoUrl) {
        contentHtml += `
            <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin-bottom: 1.5rem;">
                <iframe src="${lesson.videoUrl}" frameborder="0" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
            </div>
        `;
    }
    contentHtml += lesson.content;
    els.mContent.innerHTML = contentHtml;
    
    // Render Quiz
    els.mQuiz.innerHTML = '';
    els.mFeedback.style.display = 'none';
    els.mFeedback.className = 'quiz-feedback';
    
    if (lesson.quiz && lesson.quiz.length > 0) {
        lesson.quiz.forEach((q, index) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'quiz-question';
            
            if (q.type === 'order') {
                // Drag and Drop Rendering
                // Shuffle items for display
                const shuffled = [...q.correctOrder].sort(() => Math.random() - 0.5);
                
                qDiv.innerHTML = `
                     <p><strong>Q${index + 1}:</strong> ${q.question}</p>
                     <ul class="sortable-list" id="sortable-list-${index}">
                         ${shuffled.map(item => `
                             <li draggable="true" class="draggable-item">↕️ ${item}</li>
                         `).join('')}
                     </ul>
                `;

                // Add drag events after render
                requestAnimationFrame(() => setupDragAndDrop(index));

            } else {
                // MC Rendering
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
            }
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
    const questions = currentLesson.quiz;
    let passed = true;

    questions.forEach((q, index) => {
        let isCorrect = false;

        if (q.type === 'order') {
             // Validate Order
             const list = document.getElementById(`sortable-list-${index}`);
             if(list) {
                const items = Array.from(list.children).map(li => li.textContent.replace('↕️ ', ''));
                if (JSON.stringify(items) === JSON.stringify(q.correctOrder)) {
                    isCorrect = true;
                }
             }
        } else {
             // MC Default
             const selected = document.querySelector(`input[name="q${index}"]:checked`);
             if (selected && parseInt(selected.value) === q.answer) {
                 isCorrect = true;
             }
        }

        if (isCorrect) correctCount++;
    });


    if (correctCount === currentLesson.quiz.length) {
        // Success!
        
        // Update Class Global Stats
        try {
             const sysRef = doc(db, "system", "gamestate");
             await updateDoc(sysRef, {
                 totalLessonsCompleted: increment(1)
             });
        } catch(e) {
             console.error("Failed to update class stats", e);
             try {
                // Create if missing
                await setDoc(doc(db, "system", "gamestate"), { totalLessonsCompleted: 1 }, { merge: true });
             } catch(e2) {}
        }
        
        await completeLesson(currentLesson);
    } else {
        // Fail
        els.mFeedback.textContent = `You got ${correctCount}/${currentLesson.quiz.length} correct. Try again!`;
        els.mFeedback.className = "quiz-feedback error";
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

            // Apply XP Multiplier from Real Estate
            const multiplier = data.xpMultiplier || 1.0;
            const finalReward = Math.ceil(lesson.reward * multiplier);

            const updates = {
                balance: (data.balance || 0) + finalReward,
                netWorth: (data.netWorth || 0) + finalReward, // Update net worth too
                completedLessons: arrayUnion(lesson.id)
            };

            if (lootItem) {
                updates.inventory = arrayUnion(lootItem);
                lootMessage = `\n\nYou also found: ${lootItem.name} (${lootItem.rarity})!`;
            }

            transaction.update(userRef, updates);
        });

        // UI Success
        const multiplier = userData.xpMultiplier || 1.0;
        const finalReward = Math.ceil(lesson.reward * multiplier);
        const bonusText = multiplier > 1.0 ? ` (incl. ${((multiplier-1)*100).toFixed(0)}% Bonus)` : "";

        els.mFeedback.textContent = `Correct! You earned $${finalReward}${bonusText}!${lootMessage}`;
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

function setupDragAndDrop(index) {
    const list = document.getElementById('sortable-list-' + index);
    if (!list) return;

    let draggedItem = null;

    const items = list.querySelectorAll('.draggable-item');
    items.forEach(item => {
        item.addEventListener('dragstart', function () {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', function () {
            setTimeout(() => {
                draggedItem = null;
                item.classList.remove('dragging');
            }, 0);
        });
    });

    list.addEventListener('dragover', function (e) {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
            list.appendChild(draggedItem);
        } else {
            list.insertBefore(draggedItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
