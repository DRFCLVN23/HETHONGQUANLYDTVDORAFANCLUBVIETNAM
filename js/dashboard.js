import { 
    auth, 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDoc, 
    query, 
    orderBy, 
    limit, 
    setDoc, 
    where, 
    onSnapshot, 
    signOut 
} from './firebase-config.js';

// DOM Elements
let currentUser = null;
let translatorsData = [];
let assignmentsData = [];
let salaryData = [];

// DOM refs
const assignmentsBody = document.getElementById('assignmentsTableBody');
const transactorsBody = document.getElementById('transactorsTableBody');
const salaryBody = document.getElementById('salaryTableBody');
const documentsBody = document.getElementById('documentsTableBody');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const addModal = document.getElementById('modalTransactor');
const evalModal = document.getElementById('modalEval');
const accountInfoModal = document.getElementById('accountInfoModal');
const addModalBtn = document.getElementById('addTransactorBtn');
const importBtn = document.getElementById('importBtn');

// Tab switching
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        if (!tabId) return;
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        const target = document.getElementById('tab-' + tabId);
        if (target) target.classList.add('active');
        
        if (tabId === 'salary') loadSalary();
        if (tabId === 'transactors') loadTranslators();
        if (tabId === 'assign') loadAssignments();
        if (tabId === 'documents') loadDocuments();
    });
});

// ─── LOAD FUNCTIONS ───────────────────────────────────────────────

async function loadData() {
    await Promise.all([
        loadTranslators(),
        loadSalary(),
        loadAssignments(),
        loadDocuments(),
        updateStats()
    ]);
}

// Load translators
async function loadTranslators() {
    try {
        const querySnapshot = await getDocs(collection(db, 'Transactors'));
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
    if (!transactorsBody) return;
    
    if (data.length === 0) {
        transactorsBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:40px; color: var(--secondary);">
                    <i class="fas fa-users" style="font-size:48px; display:block; margin-bottom:12px;"></i>
                    Chưa có dịch thuật viên nào
                </td>
            </tr>
        `;
        return;
    }
    
    transactorsBody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.name || 'N/A'}</strong></td>
            <td>${item.email || 'N/A'}</td>
            <td>${item.role || 'dtv'}</td>
            <td><span class="status-badge status-${item.status || 'active'}">${item.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</span></td>
            <td>
                <button class="btn-edit" onclick="editTranslator('${item.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-danger" onclick="deleteTranslator('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load assignments - FIXED: Added finally block, error handling with retry button, empty state
async function loadAssignments() {
    // Show loading state
    if (assignmentsBody) {
        assignmentsBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:40px; color: var(--secondary);">
                    <i class="fas fa-spinner fa-spin" style="font-size:48px; display:block; margin-bottom:12px;"></i>
                    Đang tải dữ liệu...
                </td>
            </tr>
        `;
    }
    
    try {
        const querySnapshot = await getDocs(collection(db, 'assignments'));
        const assignments = [];
        querySnapshot.forEach((doc) => {
            assignments.push({ id: doc.id, ...doc.data() });
        });
        assignmentsData = assignments;
        renderAssignments(assignments);
    } catch (error) {
        console.error('Error loading assignments:', error);
        // Show error state with retry button
        if (assignmentsBody) {
            assignmentsBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center; padding:40px; color: var(--secondary);">
                        <i class="fas fa-exclamation-triangle" style="font-size:48px; display:block; margin-bottom:12px; color: var(--danger-neon);"></i>
                        <div style="font-size:16px; margin-bottom:16px; color: var(--text-main);">Không thể tải dữ liệu. Vui lòng thử lại.</div>
                        <button class="btn" onclick="loadAssignments()" style="margin:0 auto;">
                            <i class="fas fa-redo"></i> Thử lại
                        </button>
                    </td>
                </tr>
            `;
        }
    } finally {
        // Ensure loading state is cleared (already handled by renderAssignments or error state above)
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
                    <br><br>
                    <button class="btn" onclick="document.getElementById('newAssignmentBtn')?.click()" style="margin:0 auto;">
                        <i class="fas fa-plus"></i> + Tạo Task mới
                    </button>
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

function getStatusText(status) {
    switch(status) {
        case 'pending': return 'Chờ xử lý';
        case 'processing': return 'Đang thực hiện';
        case 'completed': return 'Hoàn thành';
        case 'cancelled': return 'Đã hủy';
        default: return status || 'Chờ xử lý';
    }
}

// Load documents
async function loadDocuments() {
    try {
        const querySnapshot = await getDocs(collection(db, 'documents'));
        const docs = [];
        querySnapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() });
        });
        renderDocuments(docs);
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

function renderDocuments(data) {
    if (!documentsBody) return;
    
    if (data.length === 0) {
        documentsBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:40px; color: var(--secondary);">
                    <i class="fas fa-folder-open" style="font-size:48px; display:block; margin-bottom:12px;"></i>
                    Chưa có tài liệu nào
                </td>
            </tr>
        `;
        return;
    }
    
    documentsBody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.tieuDe || item.name || 'N/A'}</strong></td>
            <td>${item.nguoiKy || item.createdBy || 'N/A'}</td>
            <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</td>
            <td>
                <a href="${item.fileUrl || item.url || '#'}" target="_blank" class="btn-edit">
                    <i class="fas fa-download"></i> Tải
                </a>
                <button class="btn-danger" onclick="deleteDocument('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Update stats
async function updateStats() {
    try {
        const transSnap = await getDocs(collection(db, 'Transactors'));
        const activeTrans = transSnap.docs.filter(d => d.data().status === 'active' || !d.data().status).length;
        document.getElementById('statActiveTrans').textContent = activeTrans;
        
        const assignmentsSnapshot = await getDocs(collection(db, 'assignments'));
        const pending = assignmentsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
        const completed = assignmentsSnapshot.docs.filter(doc => doc.data().status === 'completed').length;
        document.getElementById('statPendingTasks').textContent = pending;
        document.getElementById('statDoneTasks').textContent = completed;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// ─── EVENT HANDLERS ────────────────────────────────────────────────

// New assignment button
document.getElementById('newAssignmentBtn')?.addEventListener('click', () => {
    const dtvCode = prompt('Nhập mã DTV:');
    if (!dtvCode) return;
    
    const translator = translatorsData.find(t => t.code === dtvCode);
    if (!translator) {
        showToast('Không tìm thấy DTV với mã này', 'error');
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
        
        showToast('✅ Phân công công việc thành công!', 'success');
        loadAssignments();
        updateStats();
        loadRecentActivities();
    } catch (error) {
        console.error('Error adding assignment:', error);
        showToast('❌ Lỗi: ' + error.message, 'error');
    }
}

// Evaluate assignment
window.evaluateAssignment = function(id) {
    const score = prompt('Nhập điểm đánh giá (1-10):');
    if (score === null) return;
    
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 10) {
        showToast('Điểm phải từ 1 đến 10', 'warning');
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
        
        showToast('✅ Đánh giá công việc thành công!', 'success');
        loadAssignments();
        loadRecentActivities();
    } catch (error) {
        console.error('Error updating assignment:', error);
        showToast('❌ Lỗi: ' + error.message, 'error');
    }
}

// Delete assignment
window.deleteAssignment = async function(id) {
    if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;
    
    try {
        await deleteDoc(doc(db, 'assignments', id));
        showToast('✅ Xóa công việc thành công!', 'success');
        loadAssignments();
        updateStats();
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showToast('❌ Lỗi: ' + error.message, 'error');
    }
};

// ─── TOAST NOTIFICATION SYSTEM ─────────────────────────────────────
// Create toast container if not exists
let toastContainer = document.getElementById('toastContainer');
if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(toastContainer);
}

// Inject toast animation keyframes
if (!document.getElementById('toastStyles')) {
    const toastStyle = document.createElement('style');
    toastStyle.id = 'toastStyles';
    toastStyle.textContent = `
        @keyframes toastSlideIn {
            from { opacity: 0; transform: translateX(100px) scale(0.9); }
            to { opacity: 1; transform: translateX(0) scale(1); }
        }
    `;
    document.head.appendChild(toastStyle);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = {
        success: 'border-color:#00ff88;box-shadow:0 0 20px rgba(0,255,136,0.3),inset 0 0 20px rgba(0,255,136,0.05);',
        error: 'border-color:#ff3366;box-shadow:0 0 20px rgba(255,51,102,0.3),inset 0 0 20px rgba(255,51,102,0.05);',
        warning: 'border-color:#ffaa00;box-shadow:0 0 20px rgba(255,170,0,0.3),inset 0 0 20px rgba(255,170,0,0.05);',
        info: 'border-color:#00f0ff;box-shadow:0 0 20px rgba(0,240,255,0.3),inset 0 0 20px rgba(0,240,255,0.05);'
    };
    toast.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;background:rgba(10,11,16,0.95);backdrop-filter:blur(12px);border:1px solid;border-radius:12px;padding:14px 20px;min-width:320px;max-width:420px;pointer-events:auto;${colors[type] || colors.success}animation:toastSlideIn 0.4s cubic-bezier(0.68,-0.55,0.265,1.55);">
            <span style="font-size:22px;flex-shrink:0;">${icons[type] || icons.success}</span>
            <span style="flex:1;color:#e2e8f0;font-size:14px;font-weight:500;font-family:'Roboto',sans-serif;">${message}</span>
            <span style="font-size:16px;cursor:pointer;color:#94a3b8;transition:color 0.2s;" onclick="this.parentElement.parentElement.remove()">&times;</span>
        </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.transition = 'opacity 0.3s,transform 0.3s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Make showToast globally accessible
window.showToast = showToast;

// ─── MODAL HANDLERS ────────────────────────────────────────────────

// Close modals
document.querySelectorAll('.modal-close, .close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    });
});

// Click outside modal to close
window.addEventListener('click', (e) => {
    if (e.target === addModal) {
        addModal.style.display = 'none';
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