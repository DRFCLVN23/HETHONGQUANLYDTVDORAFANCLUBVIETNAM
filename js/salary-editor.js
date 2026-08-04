import { 
    db, 
    auth,
    doc, 
    updateDoc, 
    getDocs, 
    collection, 
    addDoc,
    onAuthStateChanged
} from './firebase-config.js';

let isEditingSalary = false;
let currentUser = null;

// Get current user from auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    }
});

// DOM Elements
const editSalaryBtn = document.getElementById('editSalaryBtn');
const saveSalaryBtn = document.getElementById('saveSalaryBtn');
const salaryTableBody = document.getElementById('salaryTableBody');

// Edit salary mode
editSalaryBtn?.addEventListener('click', () => {
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để thực hiện thao tác này', 'warning');
        return;
    }
    
    // Check if user is admin (simple check - you can implement proper role check)
    const isAdmin = confirm('Bạn có quyền Admin? Nhấn OK để tiếp tục');
    if (!isAdmin) {
        showToast('Chỉ Admin mới có quyền chỉnh sửa bảng lương', 'error');
        return;
    }
    
    isEditingSalary = true;
    editSalaryBtn.style.display = 'none';
    saveSalaryBtn.style.display = 'inline-block';
    
    // Make cells editable
    document.querySelectorAll('#salaryTableBody .editable-cell').forEach(cell => {
        const valueSpan = cell.querySelector('.cell-value');
        let currentValue = '0';
        if (valueSpan) {
            currentValue = valueSpan.textContent.replace(/[^0-9]/g, '') || '0';
        }
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'cell-input';
        input.value = currentValue;
        input.min = '0';
        input.step = '100000';
        input.style.width = '100%';
        input.style.padding = '6px 8px';
        input.style.border = '2px solid #4F46E5';
        input.style.borderRadius = '4px';
        input.style.fontSize = '14px';
        input.style.background = '#F9FAFB';
        
        // Clear cell and add input
        cell.innerHTML = '';
        cell.appendChild(input);
        cell.classList.add('editing');
        
        // Auto-calculate total on change
        input.addEventListener('change', () => {
            calculateRowTotal(cell.closest('tr'));
        });
        
        input.addEventListener('input', () => {
            calculateRowTotal(cell.closest('tr'));
        });
    });
    
    showToast('Đã bật chế độ chỉnh sửa bảng lương. Sửa các ô và nhấn "Lưu thay đổi".', 'info');
});

// Calculate total for a row
function calculateRowTotal(row) {
    if (!row) return;
    
    const inputs = row.querySelectorAll('.editable-cell input');
    let baseSalary = 0, allowance = 0, bonus = 0, deduction = 0;
    
    inputs.forEach(inp => {
        const cell = inp.closest('.editable-cell');
        if (!cell) return;
        
        const field = cell.dataset.field;
        const value = parseInt(inp.value.replace(/[^0-9]/g, '')) || 0;
        
        if (field === 'baseSalary') baseSalary = value;
        else if (field === 'allowance') allowance = value;
        else if (field === 'bonus') bonus = value;
        else if (field === 'deduction') deduction = value;
    });
    
    const total = baseSalary + allowance + bonus - deduction;
    const totalCell = row.querySelector('td:last-child strong');
    if (totalCell) {
        totalCell.textContent = total.toLocaleString() + ' VND';
    }
}

// Save salary changes
saveSalaryBtn?.addEventListener('click', async () => {
    if (!isEditingSalary) return;
    
    if (!confirm('Bạn có chắc muốn lưu các thay đổi bảng lương?')) return;
    
    try {
        const rows = document.querySelectorAll('#salaryTableBody tr');
        const updates = [];
        let hasError = false;
        
        for (const row of rows) {
            const cells = row.querySelectorAll('.editable-cell');
            const firstCell = row.querySelector('td:first-child strong');
            const code = firstCell ? firstCell.textContent : '';
            
            if (!code) continue;
            
            const data = {
                code: code,
                baseSalary: 0,
                allowance: 0,
                bonus: 0,
                deduction: 0
            };
            
            cells.forEach(cell => {
                const field = cell.dataset.field;
                const input = cell.querySelector('input');
                if (input) {
                    const value = parseInt(input.value.replace(/[^0-9]/g, '')) || 0;
                    data[field] = value;
                }
            });
            
            // Calculate total
            data.total = data.baseSalary + data.allowance + data.bonus - data.deduction;
            
            // Find document ID
            const idCell = row.querySelector('.editable-cell');
            const id = idCell ? idCell.dataset.id : null;
            
            if (id) {
                // Update in Firebase
                await updateDoc(doc(db, 'salary', id), {
                    ...data,
                    updatedAt: new Date().toISOString()
                });
                updates.push(code);
            } else {
                // Try to find by code
                const salarySnapshot = await getDocs(collection(db, 'salary'));
                let found = false;
                salarySnapshot.forEach((doc) => {
                    const docData = doc.data();
                    if (docData.code === code) {
                        updateDoc(doc(db, 'salary', doc.id), {
                            ...data,
                            updatedAt: new Date().toISOString()
                        });
                        found = true;
                        updates.push(code);
                    }
                });
                
                if (!found) {
                    // Create new salary record
                    await addDoc(collection(db, 'salary'), {
                        ...data,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    updates.push(code);
                }
            }
        }
        
        // Add activity
        await addDoc(collection(db, 'activities'), {
            action: 'salary_update',
            description: `Cập nhật bảng lương cho ${updates.length} DTV`,
            timestamp: new Date().toISOString(),
            userId: currentUser?.uid || 'unknown',
            userEmail: currentUser?.email || 'unknown',
            updatedCount: updates.length
        });
        
        showToast(`Lưu bảng lương thành công! Đã cập nhật ${updates.length} DTV.`, 'success');
        
        // Refresh and exit edit mode
        isEditingSalary = false;
        editSalaryBtn.style.display = 'inline-block';
        saveSalaryBtn.style.display = 'none';
        
        // Reload salary data
        const dashboardModule = await import('./dashboard.js');
        if (dashboardModule.loadSalary) {
            await dashboardModule.loadSalary();
        } else {
            // Fallback: reload page
            window.location.reload();
        }
        
    } catch (error) {
        console.error('Error saving salary:', error);
        showToast('Lỗi khi lưu bảng lương: ' + error.message, 'error');
    }
});

// Cancel edit mode (escape key)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isEditingSalary) {
        if (confirm('Bạn có muốn thoát chế độ chỉnh sửa mà không lưu?')) {
            isEditingSalary = false;
            editSalaryBtn.style.display = 'inline-block';
            saveSalaryBtn.style.display = 'none';
            
            // Reload to reset values
            const dashboardModule = import('./dashboard.js').then(module => {
                if (module.loadSalary) module.loadSalary();
            });
        }
    }
});

// Export for use in dashboard
export { isEditingSalary, calculateRowTotal };
