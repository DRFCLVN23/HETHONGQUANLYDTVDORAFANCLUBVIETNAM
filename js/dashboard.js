import { 
    auth, 
    db, 
    collection, 
    getDocs, 
    getDoc,
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from './firebase-config.js';

// DOM Elements
const tabs = document.querySelectorAll('.sidebar-nav a');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('pageTitle');
const userDisplay = document.getElementById('userDisplay');
const logoutBtn = document.getElementById('logoutBtn');

// Table bodies
const translatorsBody = document.getElementById('translatorsTableBody');
const salaryBody = document.getElementById('salaryTableBody');
const assignmentsBody = document.getElementById('assignmentsTableBody');

// Stats
const totalTranslators = document.getElementById('totalTranslators');
const activeTranslators = document.getElementById('activeTranslators');
const pendingTasks = document.getElementById('pendingTasks');

// Search
const searchInput = document.getElementById('searchTranslator');
const searchBtn = document.getElementById('searchBtn');

// Add translator modal
const addTranslatorBtn = document.getElementById('addTranslatorBtn');
const addModal = document.getElementById('addTranslatorModal');
const saveTranslatorBtn = document.getElementById('saveTranslatorBtn');
const cancelTranslatorBtn = document.getElementById('cancelTranslatorBtn');
const closeButtons = document.querySelectorAll('.modal .close');

// Evaluation modal
const evalModal = document.getElementById('evaluationModal');
let currentEvalDtvCode = '';

// Account info modal
const accountInfoModal = document.getElementById('accountInfoModal');

// State
let currentUser = null;
let translatorsData = [];
let currentFilter = 'all';
let isEditingTranslator = false;

// Auth check
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userDisplay.textContent = `👤 ${user.email}`;
        loadData();
    } else {
        window.location.href = 'index.html';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Logout error:', error);
        });
    }
});

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabId = tab.dataset.tab;
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        const titles = {
            dashboard: 'Tổng quan',
            translators: 'Quản lý Dịch thuật viên',
            salary: 'Bảng lương cơ bản',
            assign: 'Phân công công việc'
        };
        pageTitle.textContent = titles[tabId] || 'Tổng quan';
        
        if (tabId === 'translators') loadTranslators();
        if (tabId === 'salary') loadSalary();
        if (tabId === 'assign') loadAssignments();
    });
});

// Load all data
async function loadData() {
    await Promise.all([
        loadTranslators(),
        loadSalary(),
        loadAssignments()
    ]);
    updateStats();
    loadRecentActivities();
}

// Load Translators
async function loadTranslators() {
    try {
        const querySnapshot = await getDocs(collection(db, 'translators'));
        translatorsData = [];
        querySnapshot.forEach((doc) => {
            translatorsData.push({ id: doc.id, ...doc.data() });
        });
        renderTranslators(translatorsData);
    } catch (error) {
        console.error('Error loading translators:', error);
    }
}

function renderTranslators(data) {
    if (!translatorsBody) return;
    
    if (data.length === 0) {
        translatorsBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:40px; color: var(--secondary);">
                    <i class="fas fa-users" style="font-size:48px; display:block; margin-bottom:12px;"></i>
                    Chưa có dịch thuật viên nào
                </td>
            </tr>
        `;
        return;
    }

    translatorsBody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.code || 'N/A'}</strong></td>
            <td>${item.name || 'N/A'}</td>
            <td>${item.email || 'N/A'}</td>
            <td>${item.phone || 'N/A'}</td>
            <td>${item.specialty || 'N/A'}</td>
            <td>${item.course || 'N/A'}</td>
            <td>${item.author || 'N/A'}</td>
            <td><span class="status-badge status-${item.status || 'inactive'}">${getStatusText(item.status)}</span></td>
            <td>
                ${item.hasAccount ? `
                    <span style="color: #10B981;">
                        <i class="fas fa-check-circle"></i> Có TK
                    </span>
                ` : `
                    <span style="color: #F59E0B;">
                        <i class="fas fa-clock"></i> Chưa có TK
                    </span>
                `}
            </td>
            <td>
                <button class="btn-primary" style="padding:4px 10px; width:auto; margin-right:4px;" onclick="editTranslator('${item.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-primary" style="padding:4px 10px; width:auto; margin-right:4px;" onclick="evaluateTranslator('${item.code}')">
                    <i class="fas fa-star"></i>
                </button>
                ${!item.hasAccount ? `
                    <button class="btn-success" style="padding:4px 10px; width:auto; margin-right:4px;" onclick="createAccountForTranslator('${item.id}')">
                        <i class="fas fa-user-plus"></i>
                    </button>
                ` : `
                    <button class="btn-secondary" style="padding:4px 10px; width:auto; margin-right:4px;" onclick="resetPassword('${item.id}')">
                        <i class="fas fa-key"></i>
                    </button>
                `}
                <button class="btn-danger" style="padding:4px 10px; width:auto;" onclick="deleteTranslator('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Reset password for translator
window.resetPassword = async function(id) {
    const translator = translatorsData.find(t => t.id === id);
    if (!translator) {
        alert('Không tìm thấy DTV');
        return;
    }
    
    if (!translator.hasAccount || !translator.accountEmail) {
        alert('DTV này chưa có tài khoản để reset mật khẩu');
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn gửi email reset mật khẩu cho ${translator.name} (${translator.accountEmail})?`)) {
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, translator.accountEmail);
        alert(`✅ Đã gửi email reset mật khẩu đến ${translator.accountEmail}`);
        
        await addDoc(collection(db, 'activities'), {
            action: 'reset_password',
            translatorCode: translator.code,
            email: translator.accountEmail,
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('Lỗi reset mật khẩu: ' + error.message);
    }
};

// Create account for translator
window.createAccountForTranslator = async function(id) {
    const translator = translatorsData.find(t => t.id === id);
    if (!translator) {
        alert('Không tìm thấy DTV');
        return;
    }
    
    if (translator.hasAccount) {
        alert('DTV này đã có tài khoản');
        return;
    }
    
    const email = prompt('Nhập email đăng nhập cho DTV:', translator.email || '');
    if (!email) return;
    
    const password = prompt('Nhập mật khẩu (để trống để tạo tự động):', '');
    const finalPassword = password || generatePassword();
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, finalPassword);
        const user = userCredential.user;
        
        await updateDoc(doc(db, 'translators', id), {
            hasAccount: true,
            accountEmail: email,
            accountUid: user.uid,
            accountCreated: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        showAccountInfo(
            translator.code, 
            translator.name, 
            email, 
            finalPassword,
            translator.course || 'N/A',
            translator.author || 'N/A'
        );
        
        await addDoc(collection(db, 'activities'), {
            action: 'create_account',
            translatorCode: translator.code,
            email: email,
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });
        
        loadTranslators();
        updateStats();
        loadRecentActivities();
        
    } catch (error) {
        console.error('Error creating account:', error);
        alert('Lỗi tạo tài khoản: ' + error.message);
    }
};

// Generate random password
function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Show account info
function showAccountInfo(code, name, email, password, course = 'N/A', author = 'N/A') {
    const body = document.getElementById('accountInfoBody');
    body.innerHTML = `
        <div style="text-align: center; padding: 10px 0;">
            <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
            <h3 style="color: #10B981; margin-bottom: 8px;">Tạo tài khoản thành công!</h3>
            <p style="color: var(--secondary); margin-bottom: 20px;">Đã tạo tài khoản cho DTV <strong>${code}</strong></p>
            
            <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; text-align: left;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-weight: 600;">Mã DTV:</span>
                    <span>${code}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-weight: 600;">Họ tên:</span>
                    <span>${name}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-weight: 600;">Tên khóa:</span>
                    <span>${course}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-weight: 600;">Tác giả:</span>
                    <span>${author}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="font-weight: 600;">Email:</span>
                    <span style="color: #4F46E5;">${email}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="font-weight: 600;">Mật khẩu:</span>
                    <span style="color: #EF4444; font-weight: 600;">${password}</span>
                </div>
            </div>
            
            <div style="margin-top: 16px; padding: 12px; background: #FEF3C7; border-radius: 8px;">
                <p style="color: #92400E; font-size: 14px;">
                    <i class="fas fa-info-circle"></i> 
                    Vui lòng sao chép thông tin đăng nhập và gửi cho DTV.
                </p>
            </div>
            
            <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: center;">
                <button onclick="copyAccountInfo()" class="btn-primary" style="width: auto; padding: 8px 24px;">
                    <i class="fas fa-copy"></i> Sao chép
                </button>
                <button onclick="window.print()" class="btn-secondary" style="width: auto; padding: 8px 24px;">
                    <i class="fas fa-print"></i> In
                </button>
            </div>
        </div>
    `;
    
    accountInfoModal.style.display = 'block';
    
    window._accountInfo = { code, name, email, password, course, author };
}

// Copy account info
window.copyAccountInfo = function() {
    const info = window._accountInfo;
    if (!info) return;
    
    const text = `
═══════════════════════════════════════
   THÔNG TIN TÀI KHOẢN DTV
═══════════════════════════════════════
Mã DTV:        ${info.code}
Họ tên:        ${info.name}
Tên khóa:      ${info.course || 'N/A'}
Tác giả:       ${info.author || 'N/A'}
Email:         ${info.email}
Mật khẩu:      ${info.password}
───────────────────────────────────────
🔗 Đăng nhập tại: ${window.location.origin}
═══════════════════════════════════════
    `;
    
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Đã sao chép thông tin tài khoản!');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('✅ Đã sao chép thông tin tài khoản!');
    });
};

// Edit translator function
window.editTranslator = async function(id) {
    const translator = translatorsData.find(t => t.id === id);
    if (!translator) return;
    
    isEditingTranslator = true;
    
    document.getElementById('dtvCode').value = translator.code || '';
    document.getElementById('dtvName').value = translator.name || '';
    document.getElementById('dtvEmail').value = translator.email || '';
    document.getElementById('dtvPhone').value = translator.phone || '';
    document.getElementById('dtvSpecialty').value = translator.specialty || '';
    document.getElementById('dtvCourse').value = translator.course || '';
    document.getElementById('dtvAuthor').value = translator.author || '';
    document.getElementById('dtvAccountEmail').value = translator.accountEmail || '';
    document.getElementById('dtvAccountPassword').value = '';
    document.getElementById('dtvLoginCount').value = translator.loginCount || 0;
    document.getElementById('createAccountCheck').checked = false;
    document.getElementById('createAccountCheck').disabled = true;
    
    saveTranslatorBtn.textContent = 'Cập nhật';
    saveTranslatorBtn.dataset.editId = id;
    
    addModal.style.display = 'block';
};

// Delete translator
window.deleteTranslator = async function(id) {
    if (!confirm('Bạn có chắc muốn xóa dịch thuật viên này?')) return;
    
    try {
        const translator = translatorsData.find(t => t.id === id);
        if (translator && translator.hasAccount) {
            if (!confirm('DTV này đã có tài khoản. Bạn có muốn xóa cả tài khoản đăng nhập?')) {
                return;
            }
        }
        
        await deleteDoc(doc(db, 'translators', id));
        alert('Xóa DTV thành công!');
        loadTranslators();
        updateStats();
        loadRecentActivities();
    } catch (error) {
        console.error('Error deleting translator:', error);
        alert('Lỗi: ' + error.message);
    }
};

// Evaluate translator
window.evaluateTranslator = function(code) {
    currentEvalDtvCode = code;
    document.getElementById('evalDtvCode').textContent = code;
    document.getElementById('evalScore').value = '';
    document.getElementById('evalComment').value = '';
    document.getElementById('evalStatus').value = 'active';
    evalModal.style.display = 'block';
};

// Save evaluation
document.getElementById('saveEvaluationBtn')?.addEventListener('click', async () => {
    const score = document.getElementById('evalScore').value;
    const comment = document.getElementById('evalComment').value;
    const status = document.getElementById('evalStatus').value;
    
    if (!score) {
        alert('Vui lòng nhập điểm đánh giá');
        return;
    }
    
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 10) {
        alert('Điểm phải từ 1 đến 10');
        return;
    }
    
    try {
        const translator = translatorsData.find(t => t.code === currentEvalDtvCode);
        if (!translator) {
            alert('Không tìm thấy DTV');
            return;
        }
        
        await updateDoc(doc(db, 'translators', translator.id), {
            status: status,
            evaluation: {
                score: numScore,
                comment: comment || '',
                date: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
        });
        
        await addDoc(collection(db, 'activities'), {
            action: 'evaluate',
            translatorCode: currentEvalDtvCode,
            score: numScore,
            comment: comment || '',
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });
        
        alert('Đánh giá thành công!');
        evalModal.style.display = 'none';
        loadTranslators();
        updateStats();
        loadRecentActivities();
    } catch (error) {
        console.error('Error saving evaluation:', error);
        alert('Lỗi khi lưu đánh giá: ' + error.message);
    }
});

// Cancel evaluation
document.getElementById('cancelEvaluationBtn')?.addEventListener('click', () => {
    evalModal.style.display = 'none';
});

// Get status text
function getStatusText(status) {
    const statusMap = {
        'active': 'Đang hoạt động',
        'inactive': 'Ngừng hoạt động',
        'busy': 'Đang bận',
        'available': 'Sẵn sàng',
        'pending': 'Chờ xử lý',
        'completed': 'Hoàn thành'
    };
    return statusMap[status] || status || 'Chưa xác định';
}

// Update statistics
async function updateStats() {
    try {
        const total = translatorsData.length;
        const active = translatorsData.filter(t => t.status === 'active' || t.status === 'available').length;
        
        const assignmentsSnapshot = await getDocs(collection(db, 'assignments'));
        const pending = assignmentsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
        
        totalTranslators.textContent = total;
        activeTranslators.textContent = active;
        pendingTasks.textContent = pending;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Load recent activities
async function loadRecentActivities() {
    try {
        const activitiesRef = collection(db, 'activities');
        const q = query(activitiesRef);
        const snapshot = await getDocs(q);
        const activities = [];
        snapshot.forEach((doc) => {
            activities.push({ id: doc.id, ...doc.data() });
        });
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const recentActivities = document.getElementById('recentActivities');
        if (activities.length === 0) {
            recentActivities.innerHTML = '<p style="color: var(--secondary); padding: 20px;">Chưa có hoạt động nào</p>';
            return;
        }
        
        recentActivities.innerHTML = activities.slice(0, 5).map(activity => {
            let text = '';
            switch(activity.action) {
                case 'add':
                    text = `Thêm DTV mới: ${activity.translatorCode || 'N/A'} - ${activity.translatorName || ''}`;
                    break;
                case 'evaluate':
                    text = `Đánh giá DTV ${activity.translatorCode || 'N/A'} - Điểm: ${activity.score || 'N/A'}`;
                    break;
                case 'assign':
                    text = `Phân công công việc cho DTV ${activity.translatorCode || 'N/A'} - Dự án: ${activity.project || 'N/A'}`;
                    break;
                case 'salary_update':
                    text = `Cập nhật bảng lương`;
                    break;
                case 'create_account':
                    text = `Tạo tài khoản cho DTV ${activity.translatorCode || 'N/A'} - Email: ${activity.email || 'N/A'}`;
                    break;
                case 'reset_password':
                    text = `Gửi email reset mật khẩu cho DTV ${activity.translatorCode || 'N/A'} - ${activity.email || 'N/A'}`;
                    break;
                default:
                    text = activity.description || 'Hoạt động không xác định';
            }
            return `
                <div class="activity-item">
                    <span class="activity-text">${text}</span>
                    <span class="activity-time">${new Date(activity.timestamp).toLocaleString('vi-VN')}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Reset form
function resetTranslatorForm() {
    document.getElementById('dtvCode').value = '';
    document.getElementById('dtvName').value = '';
    document.getElementById('dtvEmail').value = '';
    document.getElementById('dtvPhone').value = '';
    document.getElementById('dtvSpecialty').value = '';
    document.getElementById('dtvCourse').value = '';
    document.getElementById('dtvAuthor').value = '';
    document.getElementById('dtvAccountEmail').value = '';
    document.getElementById('dtvAccountPassword').value = '';
    document.getElementById('dtvLoginCount').value = '0';
    document.getElementById('createAccountCheck').checked = true;
    document.getElementById('createAccountCheck').disabled = false;
    saveTranslatorBtn.textContent = 'Thêm mới';
    delete saveTranslatorBtn.dataset.editId;
    isEditingTranslator = false;
}

// Add translator
addTranslatorBtn?.addEventListener('click', () => {
    resetTranslatorForm();
    addModal.style.display = 'block';
});

// Save translator
saveTranslatorBtn?.addEventListener('click', async function() {
    console.log('Nút Thêm mới đã được bấm!');
    
    const code = document.getElementById('dtvCode').value.trim();
    const name = document.getElementById('dtvName').value.trim();
    const email = document.getElementById('dtvEmail').value.trim();
    const phone = document.getElementById('dtvPhone').value.trim();
    const specialty = document.getElementById('dtvSpecialty').value.trim();
    const course = document.getElementById('dtvCourse').value.trim();
    const author = document.getElementById('dtvAuthor').value.trim();
    const loginCount = parseInt(document.getElementById('dtvLoginCount').value) || 0;
    
    const accountEmail = document.getElementById('dtvAccountEmail').value.trim();
    const accountPassword = document.getElementById('dtvAccountPassword').value.trim();
    const createAccount = document.getElementById('createAccountCheck').checked;
    
    console.log('Dữ liệu:', { code, name, email, phone, specialty, course, author, loginCount, accountEmail, createAccount });
    
    // Validate required fields
    if (!code || !name) {
        alert('Vui lòng nhập mã DTV và họ tên');
        if (!code) document.getElementById('dtvCode').focus();
        else document.getElementById('dtvName').focus();
        return;
    }
    
    // Validate email format
    if (email && !isValidEmail(email)) {
        alert('Email không hợp lệ');
        document.getElementById('dtvEmail').focus();
        return;
    }
    
    // Validate account email if create account is checked
    if (createAccount && accountEmail) {
        if (!isValidEmail(accountEmail)) {
            alert('Email đăng nhập không hợp lệ');
            document.getElementById('dtvAccountEmail').focus();
            return;
        }
    }
    
    // Check if creating account but no email provided
    if (createAccount && !accountEmail) {
        alert('Vui lòng nhập email để tạo tài khoản hoặc bỏ chọn "Tạo tài khoản"');
        document.getElementById('dtvAccountEmail').focus();
        return;
    }
    
    const editId = saveTranslatorBtn.dataset.editId;
    
    try {
        let translatorData = {
            code,
            name,
            email: email || '',
            phone: phone || '',
            specialty: specialty || '',
            course: course || '',
            author: author || '',
            loginCount: loginCount,
            updatedAt: new Date().toISOString()
        };
        
        if (editId) {
            // Update existing translator
            await updateDoc(doc(db, 'translators', editId), translatorData);
            alert('✅ Cập nhật DTV thành công!');
            
            addModal.style.display = 'none';
            resetTranslatorForm();
            await loadTranslators();
            updateStats();
            loadRecentActivities();
            return;
        }
        
        // Check if code already exists
        const existing = translatorsData.find(t => t.code === code);
        if (existing) {
            alert('❌ Mã DTV đã tồn tại!');
            document.getElementById('dtvCode').focus();
            return;
        }
        
        // New translator data
        translatorData = {
            ...translatorData,
            status: 'active',
            hasAccount: false,
            createdAt: new Date().toISOString()
        };
        
        let accountCreated = false;
        let accountPasswordFinal = '';
        
        // Create account if requested
        if (createAccount && accountEmail) {
            accountPasswordFinal = accountPassword || generatePassword();
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, accountEmail, accountPasswordFinal);
                const user = userCredential.user;
                
                translatorData.hasAccount = true;
                translatorData.accountEmail = accountEmail;
                translatorData.accountUid = user.uid;
                translatorData.accountCreated = new Date().toISOString();
                accountCreated = true;
                
            } catch (authError) {
                console.error('Lỗi tạo tài khoản:', authError);
                if (authError.code === 'auth/email-already-in-use') {
                    alert('❌ Email này đã được sử dụng cho tài khoản khác. Vui lòng sử dụng email khác.');
                    document.getElementById('dtvAccountEmail').focus();
                    return;
                }
                alert('❌ Lỗi tạo tài khoản: ' + authError.message + '\nVẫn sẽ tạo DTV nhưng chưa có tài khoản.');
                translatorData.hasAccount = false;
            }
        }
        
        // Save translator to Firestore
        const docRef = await addDoc(collection(db, 'translators'), translatorData);
        console.log('Đã thêm DTV với ID:', docRef.id);
        
        // Log activity
        await addDoc(collection(db, 'activities'), {
            action: 'add',
            translatorCode: code,
            translatorName: name,
            hasAccount: translatorData.hasAccount || false,
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });
        
        alert('✅ Thêm DTV thành công!');
        
        // Close modal
        addModal.style.display = 'none';
        resetTranslatorForm();
        
        // Show account info if account was created
        if (accountCreated && translatorData.hasAccount) {
            showAccountInfo(
                code, 
                name, 
                accountEmail, 
                accountPasswordFinal,
                course || 'N/A',
                author || 'N/A'
            );
        }
        
        // Reload data
        await loadTranslators();
        updateStats();
        loadRecentActivities();
        
    } catch (error) {
        console.error('Lỗi khi lưu DTV:', error);
        alert('❌ Lỗi: ' + error.message);
    }
});

// Validate email
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Cancel translator
cancelTranslatorBtn?.addEventListener('click', () => {
    addModal.style.display = 'none';
    resetTranslatorForm();
});

// Close modals
closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        addModal.style.display = 'none';
        evalModal.style.display = 'none';
        accountInfoModal.style.display = 'none';
        resetTranslatorForm();
    });
});

// Click outside modal to close
window.addEventListener('click', (e) => {
    if (e.target === addModal) {
        addModal.style.display = 'none';
        resetTranslatorForm();
    }
    if (e.target === evalModal) evalModal.style.display = 'none';
    if (e.target === accountInfoModal) accountInfoModal.style.display = 'none';
});

// Search
searchBtn?.addEventListener('click', () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        renderTranslators(translatorsData);
        return;
    }
    
    const filtered = translatorsData.filter(t => 
        t.code?.toLowerCase().includes(searchTerm) || 
        t.name?.toLowerCase().includes(searchTerm) ||
        t.email?.toLowerCase().includes(searchTerm)
    );
    renderTranslators(filtered);
});

searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// Load salary
async function loadSalary() {
    try {
        const querySnapshot = await getDocs(collection(db, 'salary'));
        const salaryData = [];
        querySnapshot.forEach((doc) => {
            salaryData.push({ id: doc.id, ...doc.data() });
        });
        renderSalary(salaryData);
    } catch (error) {
        console.error('Error loading salary:', error);
    }
}

function renderSalary(data) {
    if (!salaryBody) return;
    
    if (data.length === 0) {
        salaryBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:40px; color: var(--secondary);">
                    <i class="fas fa-money-bill-wave" style="font-size:48px; display:block; margin-bottom:12px;"></i>
                    Chưa có dữ liệu bảng lương
                </td>
            </tr>
        `;
        return;
    }
    
    salaryBody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.code || 'N/A'}</strong></td>
            <td>${item.name || 'N/A'}</td>
            <td class="editable-cell" data-field="baseSalary" data-id="${item.id}">
                <span class="cell-value">${item.baseSalary ? item.baseSalary.toLocaleString() : '0'}</span>
            </td>
            <td class="editable-cell" data-field="allowance" data-id="${item.id}">
                <span class="cell-value">${item.allowance ? item.allowance.toLocaleString() : '0'}</span>
            </td>
            <td class="editable-cell" data-field="bonus" data-id="${item.id}">
                <span class="cell-value">${item.bonus ? item.bonus.toLocaleString() : '0'}</span>
            </td>
            <td class="editable-cell" data-field="deduction" data-id="${item.id}">
                <span class="cell-value">${item.deduction ? item.deduction.toLocaleString() : '0'}</span>
            </td>
            <td>
                <strong>${item.total ? item.total.toLocaleString() : '0'} VND</strong>
            </td>
        </tr>
    `).join('');
}

// Load assignments
async function loadAssignments() {
    try {
        const querySnapshot = await getDocs(collection(db, 'assignments'));
        const assignments = [];
        querySnapshot.forEach((doc) => {
            assignments.push({ id: doc.id, ...doc.data() });
        });
        renderAssignments(assignments);
    } catch (error) {
        console.error('Error loading assignments:', error);
    }
}

function renderAssignments(data) {
    if (!assignmentsBody) return;
    
    if (data.length === 0) {
        assignmentsBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:40px; color: var(--secondary);">
                    <i class="fas fa-tasks" style="font-size:48px; display:block; margin-bottom:12px;"></i>
                    Chưa có công việc nào được phân công
                </td>
            </tr>
        `;
        return;
    }
    
    assignmentsBody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.assignmentCode || 'N/A'}</strong></td>
            <td>${item.dtvCode || 'N/A'}</td>
            <td>${item.dtvName || 'N/A'}</td>
            <td>${item.project || 'N/A'}</td>
            <td>${item.assignedDate ? new Date(item.assignedDate).toLocaleDateString('vi-VN') : 'N/A'}</td>
            <td>${item.deadline ? new Date(item.deadline).toLocaleDateString('vi-VN') : 'N/A'}</td>
            <td><span class="status-badge status-${item.status || 'pending'}">${getStatusText(item.status)}</span></td>
            <td>
                ${item.evaluation ? `
                    <span title="Điểm: ${item.evaluation.score}">
                        ⭐ ${item.evaluation.score}
                    </span>
                ` : `
                    <button class="btn-primary" style="padding:4px 10px; width:auto;" onclick="evaluateAssignment('${item.id}')">
                        <i class="fas fa-star"></i>
                    </button>
                `}
            </td>
            <td>
                <button class="btn-danger" style="padding:4px 10px; width:auto;" onclick="deleteAssignment('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// New assignment
document.getElementById('newAssignmentBtn')?.addEventListener('click', () => {
    const dtvCode = prompt('Nhập mã DTV:');
    if (!dtvCode) return;
    
    const translator = translatorsData.find(t => t.code === dtvCode);
    if (!translator) {
        alert('Không tìm thấy DTV với mã này');
        return;
    }
    
    const project = prompt('Nhập tên dự án:');
    if (!project) return;
    
    const deadline = prompt('Nhập hạn chót (YYYY-MM-DD):');
    if (!deadline) return;
    
    addAssignment(dtvCode, translator.name, project, deadline);
});

async function addAssignment(dtvCode, dtvName, project, deadline) {
    try {
        const assignmentCode = `ASS-${Date.now()}`;
        await addDoc(collection(db, 'assignments'), {
            assignmentCode,
            dtvCode,
            dtvName,
            project,
            assignedDate: new Date().toISOString(),
            deadline: new Date(deadline).toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        await addDoc(collection(db, 'activities'), {
            action: 'assign',
            translatorCode: dtvCode,
            project: project,
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });
        
        alert('✅ Phân công công việc thành công!');
        loadAssignments();
        updateStats();
        loadRecentActivities();
    } catch (error) {
        console.error('Error adding assignment:', error);
        alert('❌ Lỗi: ' + error.message);
    }
}

// Evaluate assignment
window.evaluateAssignment = function(id) {
    const score = prompt('Nhập điểm đánh giá (1-10):');
    if (score === null) return;
    
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 10) {
        alert('Điểm phải từ 1 đến 10');
        return;
    }
    
    const comment = prompt('Nhận xét:');
    updateAssignment(id, numScore, comment);
};

async function updateAssignment(id, score, comment) {
    try {
        await updateDoc(doc(db, 'assignments', id), {
            evaluation: {
                score: score,
                comment: comment || '',
                date: new Date().toISOString()
            },
            status: 'completed',
            updatedAt: new Date().toISOString()
        });
        
        await addDoc(collection(db, 'activities'), {
            action: 'evaluate',
            description: `Đánh giá công việc ${id} với điểm ${score}`,
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });
        
        alert('✅ Đánh giá công việc thành công!');
        loadAssignments();
        loadRecentActivities();
    } catch (error) {
        console.error('Error updating assignment:', error);
        alert('❌ Lỗi: ' + error.message);
    }
}

// Delete assignment
window.deleteAssignment = async function(id) {
    if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;
    
    try {
        await deleteDoc(doc(db, 'assignments', id));
        alert('✅ Xóa công việc thành công!');
        loadAssignments();
        updateStats();
    } catch (error) {
        console.error('Error deleting assignment:', error);
        alert('❌ Lỗi: ' + error.message);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        loadData();
    }
});

// Make functions globally accessible
window.loadData = loadData;
window.loadTranslators = loadTranslators;
window.loadSalary = loadSalary;
window.loadAssignments = loadAssignments;
window.updateStats = updateStats;
window.loadRecentActivities = loadRecentActivities;
