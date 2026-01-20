const headerHTML = `
    <header class="main-header">
        <div class="logo">
            <h1>SS Explorer</h1>
        </div>
        <nav>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="stockmarket.html">Stocks</a></li>
                <li><a href="realestate.html">Real Estate</a></li>
                <li><a href="marketplace.html">Marketplace</a></li>
                <li><a href="students.html">Community</a></li>
                <li><a href="badges.html">Badges</a></li>
                <li><a href="lessons.html">Lessons</a></li>
                <li><a href="coins.html">Coins</a></li>
                <li><a href="profile.html" id="profile-link" style="display: none;">My Profile</a></li>
            </ul>
        </nav>
        <div class="auth-buttons">
            <button id="login-btn" class="btn btn-primary">Login</button>
        </div>
    </header>
`;

const placeholder = document.getElementById('header-placeholder');
if (placeholder) {
    placeholder.innerHTML = headerHTML;

    // Set active link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav ul li a');

    navLinks.forEach(link => {
        // Get the href attribute directly
        const href = link.getAttribute('href');
        
        // Check if it matches the current path
        if (href === currentPath) {
            link.classList.add('active');
        }
    });
}
