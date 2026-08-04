import { 
    auth, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from './firebase-config.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

// Check auth state
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
});

// Login
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        loginError.textContent = 'Vui lòng nhập đầy đủ email và mật khẩu';
        return;
    }

    try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Đang đăng nhập...';
        loginError.textContent = '';

        await signInWithEmailAndPassword(auth, email, password);
        // Redirect will happen automatically via onAuthStateChanged
    } catch (error) {
        loginError.textContent = 'Đăng nhập thất bại: ' + error.message;
        loginBtn.disabled = false;
        loginBtn.textContent = 'Đăng nhập';
    }
});

// Enter key to login
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginBtn.click();
    }
});

// Logout function (will be used in dashboard)
export function logout() {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}
