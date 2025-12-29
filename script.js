/**
 * ============================================================
 * 🎓 نظام الشكاوى والمقترحات - جامعة ميريت مصر
 * ============================================================
 * ✅ تم إضافة جميع التعديلات المطلوبة
 * ============================================================
 */

// ============================================================
// ⚙️ الإعدادات والثوابت
// ============================================================

const SUPABASE_URL = 'https://ysflfkuhzzvjzlhltkmw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZmxma3Voenp2anpsaGx0a213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NDA5NDIsImV4cCI6MjA4MjIxNjk0Mn0.KH2del7Zoh9lO46APMIdlfNvdjq6Ox6p467UCYEoCq4';
const SUPABASE_STORAGE_BUCKET = 'admin-photos';

// إنشاء عميل Supabase
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// 📊 المتغيرات العامة
// ============================================================

let currentAdmin = null;
let sessionToken = null;
let allComplaints = [];
let allAccountRequests = [];
let allStudents = [];
let allAdmins = [];
let currentPage = 1;
const itemsPerPage = 10;

// ✅ متغير لتتبع الطالب الحالي (للعودة من الشكوى)
let currentViewingStudent = null;

// ✅ متغير لحفظ بيانات الطالب لإرسال الرسالة
let messageTargetStudent = null;

// خريطة السنوات الدراسية
const yearMap = {
    'first': 'السنة الأولى',
    'second': 'السنة الثانية',
    'third': 'السنة الثالثة',
    'fourth': 'السنة الرابعة',
    'fifth': 'السنة الخامسة'
};

// خريطة الحالات
const statusMap = {
    'pending': { text: 'قيد الانتظار', class: 'status-pending' },
    'reviewed': { text: 'تمت المراجعة', class: 'status-reviewed' },
    'replied': { text: 'تم الرد', class: 'status-replied' },
    'approved': { text: 'مقبول', class: 'status-approved' },
    'rejected': { text: 'مرفوض', class: 'status-rejected' }
};

// ============================================================
// 🔔 دالة إرسال الإشعارات للطلاب
// ============================================================

async function sendUserNotification(telegramUserId, eventType, extraData = {}) {
    try {
        if (!telegramUserId) {
            console.warn('No telegram_user_id provided for notification');
            return false;
        }

        const { error } = await db
            .from('user_events')
            .insert({
                telegram_user_id: telegramUserId,
                event_type: eventType,
                extra_data: extraData,
                is_processed: false
            });

        if (error) {
            console.error('Error sending notification:', error);
            return false;
        }

        console.log(`✅ Notification sent: ${eventType} to user ${telegramUserId}`);
        return true;

    } catch (error) {
        console.error('Error in sendUserNotification:', error);
        return false;
    }
}

// ============================================================
// 🚀 التهيئة عند تحميل الصفحة
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    checkExistingSession();
    setupLoginForm();
    setupNavigation();
    setupMenuToggle();
    
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1000);
});

// ============================================================
// 📱 إعداد زر القائمة
// ============================================================

function setupMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (!menuToggle || !sidebar || !sidebarOverlay) return;

    function toggleMenu() {
        menuToggle.classList.toggle('active');
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    }

    menuToggle.addEventListener('click', toggleMenu);
    sidebarOverlay.addEventListener('click', toggleMenu);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                toggleMenu();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            menuToggle.classList.remove('active');
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ============================================================
// 🔐 إدارة الجلسات وتسجيل الدخول
// ============================================================

async function checkExistingSession() {
    const savedAdmin = localStorage.getItem('admin_data');
    
    if (savedAdmin) {
        try {
            currentAdmin = JSON.parse(savedAdmin);
            
            const { data, error } = await db
                .from('admins')
                .select('id, username, display_name, photo_url, is_owner, permissions, password_hash')
                .eq('id', currentAdmin.admin_id)
                .single();
            
            if (data && !error) {
                currentAdmin = {
                    admin_id: data.id,
                    username: data.username,
                    display_name: data.display_name,
                    photo_url: data.photo_url,
                    is_owner: data.is_owner,
                    permissions: data.permissions,
                    password_hash: data.password_hash
                };
                localStorage.setItem('admin_data', JSON.stringify(currentAdmin));
                showDashboard();
                return;
            }
        } catch (error) {
            console.error('Session verification error:', error);
        }
        
        localStorage.removeItem('admin_data');
    }
    
    showLoginPage();
}

function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        
        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق...';
        
        try {
            const { data: adminData, error: adminError } = await db
                .from('admins')
                .select('*')
                .eq('username', username)
                .single();
            
            if (adminError || !adminData) {
                showLoginError('اسم المستخدم غير موجود');
                return;
            }
            
            const isValidPassword = await verifyPassword(password, adminData.password_hash);
            
            if (!isValidPassword) {
                showLoginError('كلمة المرور غير صحيحة');
                return;
            }
            
            currentAdmin = {
                admin_id: adminData.id,
                username: adminData.username,
                display_name: adminData.display_name,
                photo_url: adminData.photo_url,
                is_owner: adminData.is_owner,
                permissions: adminData.permissions,
                password_hash: adminData.password_hash
            };
            
            localStorage.setItem('admin_data', JSON.stringify(currentAdmin));
            
            await db
                .from('admins')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', adminData.id);
            
            showDashboard();
            showToast('success', 'مرحباً بكم', `تم تسجيل الدخول بنجاح، ${currentAdmin.display_name}`);
            
        } catch (error) {
            console.error('Login error:', error);
            showLoginError('حدث خطأ أثناء تسجيل الدخول');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
        }
    });
}

async function verifyPassword(password, hash) {
    if (password === hash) {
        return true;
    }
    return false;
}

function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.querySelector('span').textContent = message;
    errorDiv.style.display = 'flex';
    
    const submitBtn = document.querySelector('.btn-login');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
}

async function logout() {
    localStorage.removeItem('admin_data');
    currentAdmin = null;
    
    showLoginPage();
    showToast('info', 'تم تسجيل الخروج', 'نراكم قريباً!');
}

function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('dashboard-page').style.display = 'none';
    
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'flex';
    
    updateAdminInfo();
    updateNavigationPermissions();
    loadDashboardData();
    setupRealtimeSubscriptions();
    loadMyProfileData();
}

function updateAdminInfo() {
    if (!currentAdmin) return;
    
    document.getElementById('admin-name').textContent = currentAdmin.display_name;
    document.getElementById('admin-role').textContent = currentAdmin.is_owner ? 'المالك' : 'مسؤول';
    
    const avatarEl = document.getElementById('admin-avatar');
    if (currentAdmin.photo_url) {
        avatarEl.innerHTML = `<img src="${currentAdmin.photo_url}" alt="${currentAdmin.display_name}">`;
    } else {
        avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
    }
}

function updateNavigationPermissions() {
    if (!currentAdmin) return;
    
    const permissions = currentAdmin.permissions || {};
    const isOwner = currentAdmin.is_owner;
    
    document.getElementById('nav-account-requests').style.display = 
        (isOwner || permissions.review_accounts) ? 'block' : 'none';
    
    document.getElementById('nav-complaints').style.display = 
        (isOwner || permissions.view_complaints) ? 'block' : 'none';
    
    document.getElementById('nav-students').style.display = 
        (isOwner || permissions.search_students) ? 'block' : 'none';
    
    document.getElementById('nav-admins').style.display = isOwner ? 'block' : 'none';
    
    // ✅ الإعدادات تظهر لكل المسؤولين
    document.getElementById('nav-settings').style.display = 'block';
    
    // ✅ إظهار/إخفاء إعدادات النظام (للمالك فقط)
    const systemSettings = document.getElementById('system-settings-section');
    if (systemSettings) {
        systemSettings.style.display = isOwner ? 'block' : 'none';
    }
    
    // ✅ إظهار عمود كلمة المرور في جدول المسؤولين (للمالك فقط)
    const thAdminPassword = document.getElementById('th-admin-password');
    if (thAdminPassword) {
        thAdminPassword.style.display = isOwner ? 'table-cell' : 'none';
    }
}

// ============================================================
// 🧭 التنقل بين التبويبات
// ============================================================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-tab') === tabId) {
            link.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    switch (tabId) {
        case 'overview': loadDashboardData(); break;
        case 'account-requests': loadAccountRequests(); break;
        case 'complaints': loadComplaints(); break;
        case 'students': loadStudents(); break;
        case 'admins': loadAdmins(); break;
        case 'settings': loadSettings(); break;
    }
}

// ============================================================
// 📊 تحميل بيانات لوحة التحكم
// ============================================================

async function loadDashboardData() {
    try {
        const { count: pendingRequests } = await db
            .from('pending_users')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        const { count: pendingComplaints } = await db
            .from('complaints')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        const { count: totalStudents } = await db
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        const { count: totalComplaints } = await db
            .from('complaints')
            .select('*', { count: 'exact', head: true });
        
        document.getElementById('stat-pending-requests').textContent = pendingRequests || 0;
        document.getElementById('stat-pending-complaints').textContent = pendingComplaints || 0;
        document.getElementById('stat-total-students').textContent = totalStudents || 0;
        document.getElementById('stat-total-complaints').textContent = totalComplaints || 0;
        
        updateBadge('pending-requests-badge', pendingRequests);
        updateBadge('pending-complaints-badge', pendingComplaints);
        
        loadRecentComplaints();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('error', 'خطأ', 'فشل تحميل بيانات لوحة التحكم');
    }
}

async function loadRecentComplaints() {
    try {
        const { data: complaints, error } = await db
            .from('complaints')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const tableBody = document.getElementById('recent-complaints-table');
        
        if (!complaints || complaints.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>لا توجد شكاوى حتى الآن</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = complaints.map(complaint => `
            <tr>
                <td><strong>#${complaint.ticket_number}</strong></td>
                <td>${escapeHtml(complaint.student_name)}</td>
                <td>${yearMap[complaint.year] || complaint.year}</td>
                <td><span class="status-badge ${statusMap[complaint.status].class}">${statusMap[complaint.status].text}</span></td>
                <td>${formatDate(complaint.created_at)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent complaints:', error);
    }
}

function updateBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (count && count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================================
// 📝 إدارة طلبات التسجيل
// ============================================================

async function loadAccountRequests() {
    try {
        const { data: requests, error } = await db
            .from('pending_users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allAccountRequests = requests || [];
        filterAccountRequests();
        
    } catch (error) {
        console.error('Error loading account requests:', error);
        showToast('error', 'خطأ', 'فشل تحميل طلبات التسجيل');
    }
}

function filterAccountRequests() {
    const statusFilter = document.getElementById('filter-request-status').value;
    const yearFilter = document.getElementById('filter-request-year').value;
    
    let filtered = [...allAccountRequests];
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    if (yearFilter !== 'all') {
        filtered = filtered.filter(r => r.year === yearFilter);
    }
    
    renderAccountRequestsTable(filtered);
}

function renderAccountRequestsTable(requests) {
    const tableBody = document.getElementById('account-requests-table');
    
    if (!requests || requests.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد طلبات تسجيل</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = requests.map(request => `
        <tr>
            <td>
                <div class="student-cell">
                    <div class="student-avatar">${getInitials(request.full_name)}</div>
                    <span>${escapeHtml(request.full_name)}</span>
                </div>
            </td>
            <td>${escapeHtml(request.student_code)}</td>
            <td>${yearMap[request.year] || request.year}</td>
            <td>${escapeHtml(request.phone)}</td>
            <td>${formatDate(request.created_at)}</td>
            <td><span class="status-badge ${statusMap[request.status]?.class || 'status-pending'}">${statusMap[request.status]?.text || request.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewRequestDetail('${request.id}')" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${request.status === 'pending' ? `
                        <button class="btn-action btn-approve" onclick="quickApproveRequest('${request.id}')" title="قبول">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-action btn-reject" onclick="quickRejectRequest('${request.id}')" title="رفض">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

async function viewRequestDetail(requestId) {
    const request = allAccountRequests.find(r => r.id === requestId);
    if (!request) return;
    
    document.getElementById('request-detail-id').value = requestId;
    document.getElementById('request-detail-name').textContent = request.full_name;
    document.getElementById('request-detail-code').textContent = request.student_code;
    document.getElementById('request-detail-year').textContent = yearMap[request.year] || request.year;
    document.getElementById('request-detail-phone').textContent = request.phone;
    document.getElementById('request-detail-national-id').textContent = request.national_id;
    document.getElementById('request-detail-date').textContent = formatDateTime(request.created_at);
    
    const passwordField = document.getElementById('request-detail-password');
    passwordField.innerHTML = `
        <span class="password-hidden">••••••••</span>
        <button class="btn-show-password" onclick="toggleRequestPassword()">
            <i class="fas fa-eye"></i>
        </button>
    `;
    passwordField.setAttribute('data-password', request.sis_password);
    
    const photoEl = document.getElementById('request-detail-photo');
    if (request.id_photo_url) {
        photoEl.src = request.id_photo_url;
        photoEl.style.display = 'block';
    } else {
        photoEl.style.display = 'none';
    }
    
    const footer = document.querySelector('#modal-request-detail .modal-footer');
    if (request.status === 'pending') {
        footer.innerHTML = `
            <input type="hidden" id="request-detail-id" value="${requestId}">
            <button class="btn btn-success" onclick="approveRequest()">
                <i class="fas fa-check"></i>
                قبول الطلب
            </button>
            <button class="btn btn-danger" onclick="openRejectModal()">
                <i class="fas fa-times"></i>
                رفض الطلب
            </button>
            <button class="btn btn-secondary" onclick="closeModal('modal-request-detail')">
                إغلاق
            </button>
        `;
    } else {
        footer.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal('modal-request-detail')">
                إغلاق
            </button>
        `;
    }
    
    openModal('modal-request-detail');
}

function toggleRequestPassword() {
    const passwordField = document.getElementById('request-detail-password');
    const hiddenSpan = passwordField.querySelector('.password-hidden');
    const button = passwordField.querySelector('.btn-show-password');
    const password = passwordField.getAttribute('data-password');
    
    if (hiddenSpan.textContent === '••••••••') {
        hiddenSpan.textContent = password;
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        hiddenSpan.textContent = '••••••••';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

async function quickApproveRequest(requestId) {
    if (!currentAdmin) return;
    
    showConfirmModal(
        'تأكيد القبول',
        'هل أنت متأكد من قبول هذا الطلب؟',
        async () => {
            try {
                const request = allAccountRequests.find(r => r.id === requestId);
                if (!request) {
                    showToast('error', 'خطأ', 'لم يتم العثور على الطلب');
                    return;
                }
                
                const { error: insertError } = await db
                    .from('users')
                    .insert({
                        full_name: request.full_name,
                        student_code: request.student_code,
                        national_id: request.national_id,
                        phone: request.phone,
                        year: request.year,
                        sis_password: request.sis_password,
                        telegram_user_id: request.telegram_user_id || null,
                        id_photo_url: request.id_photo_url || null
                    });
                
                if (insertError) {
                    if (insertError.code === '23505') {
                        showToast('error', 'خطأ', 'هذا الطالب مسجل بالفعل');
                        return;
                    }
                    throw insertError;
                }
                
                const { error: updateError } = await db
                    .from('pending_users')
                    .update({
                        status: 'approved',
                        processed_by_admin_id: currentAdmin.admin_id,
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', requestId);
                
                if (updateError) throw updateError;
                
                if (request.telegram_user_id) {
                    await sendUserNotification(
                        request.telegram_user_id,
                        'account_approved',
                        {
                            student_name: request.full_name,
                            student_code: request.student_code
                        }
                    );
                }
                
                showToast('success', 'تم القبول', 'تم قبول طلب التسجيل بنجاح وإشعار الطالب');
                loadAccountRequests();
                loadDashboardData();
                
            } catch (error) {
                console.error('Error approving request:', error);
                showToast('error', 'خطأ', 'فشل قبول الطلب');
            }
        }
    );
}

async function approveRequest() {
    const requestId = document.getElementById('request-detail-id').value;
    if (!requestId || !currentAdmin) return;
    
    try {
        const request = allAccountRequests.find(r => r.id === requestId);
        if (!request) {
            showToast('error', 'خطأ', 'لم يتم العثور على الطلب');
            return;
        }
        
        const { error: insertError } = await db
            .from('users')
            .insert({
                full_name: request.full_name,
                student_code: request.student_code,
                national_id: request.national_id,
                phone: request.phone,
                year: request.year,
                sis_password: request.sis_password,
                telegram_user_id: request.telegram_user_id || null,
                id_photo_url: request.id_photo_url || null
            });
        
        if (insertError) {
            if (insertError.code === '23505') {
                showToast('error', 'خطأ', 'هذا الطالب مسجل بالفعل');
                return;
            }
            throw insertError;
        }
        
        const { error: updateError } = await db
            .from('pending_users')
            .update({
                status: 'approved',
                processed_by_admin_id: currentAdmin.admin_id,
                processed_at: new Date().toISOString()
            })
            .eq('id', requestId);
        
        if (updateError) throw updateError;
        
        if (request.telegram_user_id) {
            await sendUserNotification(
                request.telegram_user_id,
                'account_approved',
                {
                    student_name: request.full_name,
                    student_code: request.student_code
                }
            );
        }
        
        closeModal('modal-request-detail');
        showToast('success', 'تم القبول', 'تم قبول طلب التسجيل بنجاح وإشعار الطالب');
        loadAccountRequests();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error approving request:', error);
        showToast('error', 'خطأ', 'فشل قبول الطلب: ' + (error.message || ''));
    }
}

function openRejectModal() {
    document.getElementById('reject-reason').value = '';
    openModal('modal-reject-reason');
}

async function confirmRejectRequest() {
    const requestId = document.getElementById('request-detail-id').value;
    const reason = document.getElementById('reject-reason').value.trim();
    
    if (!requestId || !currentAdmin) return;
    
    try {
        const request = allAccountRequests.find(r => r.id === requestId);
        
        const { error } = await db
            .from('pending_users')
            .update({
                status: 'rejected',
                rejection_reason: reason || null,
                processed_by_admin_id: currentAdmin.admin_id,
                processed_at: new Date().toISOString()
            })
            .eq('id', requestId);
        
        if (error) throw error;
        
        if (request && request.telegram_user_id) {
            await sendUserNotification(
                request.telegram_user_id,
                'account_rejected',
                {
                    student_name: request.full_name,
                    reason: reason || 'لم يتم تحديد السبب'
                }
            );
        }
        
        closeModal('modal-reject-reason');
        closeModal('modal-request-detail');
        showToast('success', 'تم الرفض', 'تم رفض طلب التسجيل وإشعار الطالب');
        loadAccountRequests();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        showToast('error', 'خطأ', 'فشل رفض الطلب');
    }
}

function quickRejectRequest(requestId) {
    document.getElementById('request-detail-id').value = requestId;
    openRejectModal();
}

// ============================================================
// 📩 إدارة الشكاوى
// ============================================================

async function loadComplaints() {
    try {
        const { data: complaints, error } = await db
            .from('complaints')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allComplaints = complaints || [];
        currentPage = 1;
        filterComplaints();
        
    } catch (error) {
        console.error('Error loading complaints:', error);
        showToast('error', 'خطأ', 'فشل تحميل الشكاوى');
    }
}

function searchComplaints() {
    filterComplaints();
}

function filterComplaints() {
    const searchTerm = document.getElementById('complaints-search').value.trim().toLowerCase();
    const statusFilter = document.getElementById('filter-complaint-status').value;
    const yearFilter = document.getElementById('filter-complaint-year').value;
    const periodFilter = document.getElementById('filter-complaint-period').value;
    const sortOrder = document.getElementById('filter-complaint-sort').value;
    
    let filtered = [...allComplaints];
    
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.ticket_number.toString().includes(searchTerm) ||
            c.student_code.toLowerCase().includes(searchTerm) ||
            c.student_name.toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    if (yearFilter !== 'all') {
        filtered = filtered.filter(c => c.year === yearFilter);
    }
    
    if (periodFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        filtered = filtered.filter(c => {
            const createdAt = new Date(c.created_at);
            
            switch (periodFilter) {
                case 'today':
                    return createdAt >= today;
                case 'week':
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return createdAt >= weekAgo;
                case 'month':
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return createdAt >= monthAgo;
                default:
                    return true;
            }
        });
    }
    
    filtered.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    renderComplaintsTable(filtered);
}

function renderComplaintsTable(complaints) {
    const tableBody = document.getElementById('complaints-table');
    const paginationEl = document.getElementById('complaints-pagination');
    
    if (!complaints || complaints.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد شكاوى</p>
                </td>
            </tr>
        `;
        paginationEl.innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(complaints.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedComplaints = complaints.slice(startIndex, endIndex);
    
    tableBody.innerHTML = paginatedComplaints.map(complaint => `
        <tr>
            <td><strong>#${complaint.ticket_number}</strong></td>
            <td>
                <div class="student-cell">
                    <div class="student-avatar">${getInitials(complaint.student_name)}</div>
                    <span>${escapeHtml(complaint.student_name)}</span>
                </div>
            </td>
            <td>${escapeHtml(complaint.student_code)}</td>
            <td>${yearMap[complaint.year] || complaint.year}</td>
            <td><span class="content-preview">${escapeHtml(complaint.content.substring(0, 50))}${complaint.content.length > 50 ? '...' : ''}</span></td>
            <td><span class="status-badge ${statusMap[complaint.status].class}">${statusMap[complaint.status].text}</span></td>
            <td>${formatDate(complaint.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewComplaintDetail('${complaint.id}')" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    renderPagination(paginationEl, totalPages, complaints.length);
}

function renderPagination(container, totalPages, totalItems) {
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    html += `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span style="padding: 0 0.5rem;">...</span>`;
        }
    }
    
    html += `
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    filterComplaints();
}

// ✅ عرض تفاصيل الشكوى (معدّل لدعم العودة للطالب)
async function viewComplaintDetail(complaintId, fromStudent = false) {
    const complaint = allComplaints.find(c => c.id === complaintId);
    if (!complaint) return;
    
    document.getElementById('complaint-detail-id').value = complaintId;
    document.getElementById('complaint-detail-ticket').textContent = `#${complaint.ticket_number}`;
    document.getElementById('complaint-detail-name').textContent = complaint.student_name;
    document.getElementById('complaint-detail-code').textContent = complaint.student_code;
    document.getElementById('complaint-detail-year').textContent = yearMap[complaint.year] || complaint.year;
    document.getElementById('complaint-detail-date').textContent = formatDateTime(complaint.created_at);
    document.getElementById('complaint-detail-status').innerHTML = `<span class="status-badge ${statusMap[complaint.status].class}">${statusMap[complaint.status].text}</span>`;
    document.getElementById('complaint-detail-content').textContent = complaint.content;
    
    const replyInfo = document.getElementById('reply-info');
    const replyBox = document.getElementById('complaint-detail-reply');
    
    if (complaint.admin_reply) {
        replyBox.textContent = complaint.admin_reply;
        replyBox.classList.add('reply-box');
        replyInfo.style.display = 'block';
        document.getElementById('complaint-detail-replied-by').textContent = complaint.replied_by_admin_name || 'غير معروف';
        document.getElementById('complaint-detail-replied-at').textContent = formatDateTime(complaint.replied_at);
    } else {
        replyBox.textContent = 'لم يتم الرد بعد';
        replyBox.classList.remove('reply-box');
        replyInfo.style.display = 'none';
    }
    
    // ✅ إظهار/إخفاء زر العودة للطالب
    const backToStudentBtn = document.getElementById('btn-back-to-student');
    if (fromStudent && currentViewingStudent) {
        document.getElementById('complaint-from-student-id').value = currentViewingStudent.id;
        backToStudentBtn.style.display = 'inline-flex';
    } else {
        backToStudentBtn.style.display = 'none';
    }
    
    const actionsDiv = document.getElementById('complaint-actions');
    const permissions = currentAdmin?.permissions || {};
    const isOwner = currentAdmin?.is_owner;
    
    let actionsHtml = '';
    
    if (complaint.status === 'pending' && (isOwner || permissions.mark_reviewed)) {
        actionsHtml += `
            <button class="btn btn-warning" onclick="markComplaintReviewed()">
                <i class="fas fa-eye"></i>
                تحديد كمُراجَع
            </button>
        `;
    }
    
    if (complaint.status !== 'replied' && (isOwner || permissions.reply_complaints)) {
        actionsHtml += `
            <button class="btn btn-primary" onclick="openReplyModal()">
                <i class="fas fa-reply"></i>
                الرد على الشكوى
            </button>
        `;
    }
    
    actionsDiv.innerHTML = actionsHtml;
    
    openModal('modal-complaint-detail');
}

// ✅ العودة للطالب من الشكوى
function backToStudentFromComplaint() {
    closeModal('modal-complaint-detail');
    if (currentViewingStudent) {
        setTimeout(() => {
            viewStudentDetail(currentViewingStudent.id);
        }, 300);
    }
}

async function markComplaintReviewed() {
    const complaintId = document.getElementById('complaint-detail-id').value;
    if (!complaintId || !currentAdmin) return;
    
    try {
        const complaint = allComplaints.find(c => c.id === complaintId);
        
        const { error } = await db
            .from('complaints')
            .update({
                status: 'reviewed',
                reviewed_by_admin_id: currentAdmin.admin_id,
                reviewed_by_admin_name: currentAdmin.display_name,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', complaintId);
        
        if (error) throw error;
        
        if (complaint && complaint.telegram_user_id) {
            await sendUserNotification(
                complaint.telegram_user_id,
                'complaint_reviewed',
                {
                    ticket_number: complaint.ticket_number,
                    student_name: complaint.student_name
                }
            );
        }
        
        closeModal('modal-complaint-detail');
        showToast('success', 'تمت المراجعة', 'تم تحديد الشكوى كمُراجَعة وإشعار الطالب');
        loadComplaints();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error marking as reviewed:', error);
        showToast('error', 'خطأ', 'فشل تحديد الشكوى كمُراجَعة');
    }
}

function openReplyModal() {
    document.getElementById('reply-text').value = '';
    openModal('modal-reply');
}

async function sendReply() {
    const complaintId = document.getElementById('complaint-detail-id').value;
    const replyText = document.getElementById('reply-text').value.trim();
    
    if (!complaintId || !currentAdmin) return;
    
    if (!replyText) {
        showToast('warning', 'تنبيه', 'يُرجى كتابة نص الرد');
        return;
    }
    
    try {
        const complaint = allComplaints.find(c => c.id === complaintId);
        
        const { error } = await db
            .from('complaints')
            .update({
                status: 'replied',
                admin_reply: replyText,
                replied_by_admin_id: currentAdmin.admin_id,
                replied_by_admin_name: currentAdmin.display_name,
                replied_at: new Date().toISOString()
            })
            .eq('id', complaintId);
        
        if (error) throw error;
        
        if (complaint && complaint.telegram_user_id) {
            await sendUserNotification(
                complaint.telegram_user_id,
                'complaint_replied',
                {
                    ticket_number: complaint.ticket_number,
                    reply: replyText,
                    student_name: complaint.student_name
                }
            );
        }
        
        closeModal('modal-reply');
        closeModal('modal-complaint-detail');
        showToast('success', 'تم الإرسال', 'تم إرسال الرد بنجاح وإشعار الطالب');
        loadComplaints();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error sending reply:', error);
        showToast('error', 'خطأ', 'فشل إرسال الرد');
    }
}

// ============================================================
// 👥 إدارة الطلاب
// ============================================================

async function loadStudents() {
    try {
        const { data: students, error } = await db
            .from('users')
            .select('*')
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        
        allStudents = students || [];
        filterStudents();
        
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('error', 'خطأ', 'فشل تحميل الطلاب');
    }
}

function searchStudents() {
    filterStudents();
}

function filterStudents() {
    const searchTerm = document.getElementById('students-search').value.trim().toLowerCase();
    const yearFilter = document.getElementById('filter-student-year').value;
    
    let filtered = [...allStudents];
    
    if (searchTerm) {
        filtered = filtered.filter(s => 
            s.full_name.toLowerCase().includes(searchTerm) ||
            s.student_code.toLowerCase().includes(searchTerm)
        );
    }
    
    if (yearFilter !== 'all') {
        filtered = filtered.filter(s => s.year === yearFilter);
    }
    
    renderStudentsTable(filtered);
}

function renderStudentsTable(students) {
    const tableBody = document.getElementById('students-table');
    
    if (!students || students.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>لا يوجد طلاب مسجلون</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = students.map(student => `
        <tr>
            <td>
                <div class="student-cell">
                    <div class="student-avatar">${getInitials(student.full_name)}</div>
                    <span>${escapeHtml(student.full_name)}</span>
                </div>
            </td>
            <td>${escapeHtml(student.student_code)}</td>
            <td>${yearMap[student.year] || student.year}</td>
            <td>${escapeHtml(student.phone || '-')}</td>
            <td>${formatDate(student.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewStudentDetail('${student.id}')" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ✅ عرض تفاصيل الطالب (معدّل)
async function viewStudentDetail(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;
    
    // حفظ الطالب الحالي للعودة إليه
    currentViewingStudent = student;
    
    document.getElementById('student-detail-id').value = student.id;
    document.getElementById('student-detail-telegram-id').value = student.telegram_user_id || '';
    document.getElementById('student-detail-name').textContent = student.full_name;
    document.getElementById('student-detail-code').textContent = student.student_code;
    document.getElementById('student-detail-year').textContent = yearMap[student.year] || student.year;
    document.getElementById('student-detail-phone').textContent = student.phone || '-';
    document.getElementById('student-detail-date').textContent = formatDate(student.created_at);
    
    // ✅ كلمة مرور SIS
    const passwordField = document.getElementById('student-detail-password');
    passwordField.innerHTML = `
        <span class="password-hidden">••••••••</span>
        <button class="btn-show-password" onclick="toggleStudentPassword()">
            <i class="fas fa-eye"></i>
        </button>
    `;
    passwordField.setAttribute('data-password', student.sis_password || '');
    
    // حفظ رابط صورة الكارنيه
    document.getElementById('student-detail-id').setAttribute('data-photo-url', student.id_photo_url || '');
    
    try {
        const { data: complaints, error } = await db
            .from('complaints')
            .select('*')
            .eq('student_code', student.student_code)
            .order('created_at', { ascending: false });
        
        const complaintsCount = complaints?.length || 0;
        document.getElementById('student-detail-complaints-count').textContent = complaintsCount;
        
        const tableBody = document.getElementById('student-complaints-table');
        
        if (!complaints || complaints.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <p>لا توجد شكاوى</p>
                    </td>
                </tr>
            `;
        } else {
            // ✅ تحديث allComplaints لتشمل شكاوى هذا الطالب
            complaints.forEach(c => {
                if (!allComplaints.find(ac => ac.id === c.id)) {
                    allComplaints.push(c);
                }
            });
            
            tableBody.innerHTML = complaints.map(c => `
                <tr>
                    <td><strong>#${c.ticket_number}</strong></td>
                    <td><span class="status-badge ${statusMap[c.status].class}">${statusMap[c.status].text}</span></td>
                    <td>${formatDate(c.created_at)}</td>
                    <td>
                        <button class="btn-action btn-view" onclick="viewComplaintFromStudent('${c.id}')" title="عرض">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading student complaints:', error);
    }
    
    openModal('modal-student-detail');
}

// ✅ عرض شكوى من داخل الطالب
function viewComplaintFromStudent(complaintId) {
    closeModal('modal-student-detail');
    setTimeout(() => {
        viewComplaintDetail(complaintId, true);
    }, 300);
}

// ✅ إظهار/إخفاء كلمة مرور الطالب
function toggleStudentPassword() {
    const passwordField = document.getElementById('student-detail-password');
    const hiddenSpan = passwordField.querySelector('.password-hidden');
    const button = passwordField.querySelector('.btn-show-password');
    const password = passwordField.getAttribute('data-password');
    
    if (hiddenSpan.textContent === '••••••••') {
        hiddenSpan.textContent = password || '-';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        hiddenSpan.textContent = '••••••••';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// ✅ فتح نافذة صورة الكارنيه
function openStudentIdCard() {
    const photoUrl = document.getElementById('student-detail-id').getAttribute('data-photo-url');
    
    if (!photoUrl) {
        showToast('warning', 'تنبيه', 'لا توجد صورة كارنيه لهذا الطالب');
        return;
    }
    
    document.getElementById('student-id-card-image').src = photoUrl;
    openModal('modal-student-id-card');
}

// ✅ تنزيل صورة الكارنيه
function downloadStudentIdCard() {
    const photoUrl = document.getElementById('student-id-card-image').src;
    if (!photoUrl) return;
    
    const studentName = document.getElementById('student-detail-name').textContent;
    const studentCode = document.getElementById('student-detail-code').textContent;
    
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `كارنيه_${studentCode}_${studentName}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ✅ تنزيل الصورة في وضع العرض الكامل
function downloadFullscreenImage() {
    const imgSrc = document.getElementById('fullscreen-image').src;
    if (!imgSrc) return;
    
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = 'image_' + Date.now() + '.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// ✅ إرسال رسالة للطالب
// ============================================================

function openSendMessageModal() {
    const studentName = document.getElementById('student-detail-name').textContent;
    const studentCode = document.getElementById('student-detail-code').textContent;
    const telegramId = document.getElementById('student-detail-telegram-id').value;
    
    if (!telegramId) {
        showToast('warning', 'تنبيه', 'هذا الطالب ليس لديه حساب تيليجرام مرتبط');
        return;
    }
    
    messageTargetStudent = {
        name: studentName,
        code: studentCode,
        telegram_id: telegramId
    };
    
    document.getElementById('message-recipient-name').textContent = studentName;
    document.getElementById('message-recipient-code').textContent = studentCode;
    document.getElementById('message-text').value = '';
    
    openModal('modal-send-message');
}

function confirmSendMessage() {
    const messageText = document.getElementById('message-text').value.trim();
    
    if (!messageText) {
        showToast('warning', 'تنبيه', 'يُرجى كتابة نص الرسالة');
        return;
    }
    
    document.getElementById('confirm-message-text').textContent = messageText;
    openModal('modal-confirm-message');
}

async function sendMessageToStudent() {
    if (!messageTargetStudent || !currentAdmin) return;
    
    const messageText = document.getElementById('message-text').value.trim();
    
    try {
        await sendUserNotification(
            parseInt(messageTargetStudent.telegram_id),
            'admin_message',
            {
                message: messageText,
                admin_name: currentAdmin.display_name,
                student_name: messageTargetStudent.name
            }
        );
        
        closeModal('modal-confirm-message');
        closeModal('modal-send-message');
        showToast('success', 'تم الإرسال', 'تم إرسال الرسالة للطالب بنجاح');
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('error', 'خطأ', 'فشل إرسال الرسالة');
    }
}

// ============================================================
// 👮 إدارة المسؤولين
// ============================================================

async function loadAdmins() {
    try {
        const { data: admins, error } = await db
            .from('admins')
            .select('id, username, display_name, photo_url, is_owner, permissions, password_hash, last_login_at, created_at')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        allAdmins = admins || [];
        renderAdminsTable(allAdmins);
        
    } catch (error) {
        console.error('Error loading admins:', error);
        showToast('error', 'خطأ', 'فشل تحميل المسؤولين');
    }
}

function renderAdminsTable(admins) {
    const tableBody = document.getElementById('admins-table');
    const isOwner = currentAdmin?.is_owner;
    
    if (!admins || admins.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${isOwner ? 7 : 6}" class="empty-state">
                    <i class="fas fa-user-shield"></i>
                    <p>لا يوجد مسؤولون</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = admins.map(admin => {
        const permissions = admin.permissions || {};
        const permissionsList = [];
        if (admin.is_owner) permissionsList.push('المالك');
        else {
            if (permissions.view_complaints) permissionsList.push('عرض الشكاوى');
            if (permissions.reply_complaints) permissionsList.push('الرد');
            if (permissions.mark_reviewed) permissionsList.push('المراجعة');
            if (permissions.search_students) permissionsList.push('البحث');
            if (permissions.review_accounts) permissionsList.push('الطلبات');
        }
        
        // ✅ عمود كلمة المرور للمالك
        const passwordCell = isOwner ? `
            <td>
                <span class="password-field" data-password="${admin.password_hash || ''}">
                    <span class="password-hidden">••••••••</span>
                    <button class="btn-show-password" onclick="toggleAdminPasswordInTable(this)">
                        <i class="fas fa-eye"></i>
                    </button>
                </span>
            </td>
        ` : '';
        
        return `
            <tr>
                <td>
                    <div class="student-avatar" style="width: 40px; height: 40px;">
                        ${admin.photo_url ? `<img src="${admin.photo_url}" alt="${admin.display_name}">` : `<i class="fas fa-user"></i>`}
                    </div>
                </td>
                <td>${escapeHtml(admin.display_name)}</td>
                <td>${escapeHtml(admin.username)}</td>
                ${passwordCell}
                <td><span style="font-size: 0.85em; color: var(--gray-600);">${permissionsList.join('، ') || 'لا توجد'}</span></td>
                <td>${admin.last_login_at ? formatDate(admin.last_login_at) : 'لم يسجل دخول'}</td>
                <td>
                    <div class="action-buttons">
                        ${!admin.is_owner ? `
                            <button class="btn-action btn-edit" onclick="openEditAdminModal('${admin.id}')" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action btn-delete" onclick="deleteAdmin('${admin.id}')" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : '<span style="color: var(--gray-400); font-size: 0.85em;">المالك</span>'}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ✅ إظهار/إخفاء كلمة مرور المسؤول في الجدول
function toggleAdminPasswordInTable(button) {
    const container = button.closest('.password-field');
    const hiddenSpan = container.querySelector('.password-hidden');
    const password = container.getAttribute('data-password');
    
    if (hiddenSpan.textContent === '••••••••') {
        hiddenSpan.textContent = password || '-';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        hiddenSpan.textContent = '••••••••';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

function openAddAdminModal() {
    document.getElementById('add-admin-form').reset();
    
    // إعادة تعيين معاينة الصورة
    const preview = document.getElementById('admin-photo-preview');
    preview.innerHTML = '<i class="fas fa-user"></i>';
    preview.classList.remove('has-image');
    document.getElementById('admin-remove-photo').style.display = 'none';
    
    openModal('modal-add-admin');
}

// ✅ معاينة صورة المسؤول
function previewAdminPhoto(input, previewId) {
    const preview = document.getElementById(previewId);
    const removeBtn = document.getElementById(previewId.replace('preview', 'remove-photo').replace('-photo-preview', '-remove-photo'));
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // التحقق من الحجم (2MB max)
        if (file.size > 2 * 1024 * 1024) {
            showToast('warning', 'تنبيه', 'حجم الصورة يجب أن يكون أقل من 2MB');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="صورة">`;
            preview.classList.add('has-image');
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
    }
}

// ✅ إزالة صورة المسؤول
function removeAdminPhoto(previewId, inputId) {
    const preview = document.getElementById(previewId);
    const input = document.getElementById(inputId);
    const removeBtn = document.getElementById(previewId.replace('preview', 'remove-photo').replace('-photo-preview', '-remove-photo'));
    
    preview.innerHTML = '<i class="fas fa-user"></i>';
    preview.classList.remove('has-image');
    input.value = '';
    if (removeBtn) removeBtn.style.display = 'none';
}

// ✅ رفع صورة إلى Supabase Storage
async function uploadAdminPhoto(file) {
    try {
        const timestamp = Date.now();
        const fileName = `admin_${timestamp}_${file.name}`;
        
        const { data, error } = await db.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        const { data: urlData } = db.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .getPublicUrl(fileName);
        
        return urlData.publicUrl;
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        throw error;
    }
}

async function addAdmin() {
    const username = document.getElementById('admin-username').value.trim();
    const displayName = document.getElementById('admin-display-name').value.trim();
    const password = document.getElementById('admin-password').value;
    const passwordConfirm = document.getElementById('admin-password-confirm').value;
    const photoFile = document.getElementById('admin-photo-file').files[0];
    
    if (!username || !displayName || !password) {
        showToast('warning', 'تنبيه', 'يُرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    if (password !== passwordConfirm) {
        showToast('warning', 'تنبيه', 'كلمتا المرور غير متطابقتين');
        return;
    }
    
    if (password.length < 6) {
        showToast('warning', 'تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }
    
    const permissions = {
        view_complaints: document.getElementById('perm-view-complaints').checked,
        reply_complaints: document.getElementById('perm-reply-complaints').checked,
        mark_reviewed: document.getElementById('perm-mark-reviewed').checked,
        search_students: document.getElementById('perm-search-students').checked,
        review_accounts: document.getElementById('perm-review-accounts').checked,
        manage_admins: document.getElementById('perm-manage-admins').checked
    };
    
    try {
        let photoUrl = null;
        
        // ✅ رفع الصورة إذا وجدت
        if (photoFile) {
            showToast('info', 'جارٍ الرفع', 'جارٍ رفع الصورة...');
            photoUrl = await uploadAdminPhoto(photoFile);
        }
        
        const { data, error } = await db
            .from('admins')
            .insert({
                username: username,
                password_hash: password,
                display_name: displayName,
                photo_url: photoUrl,
                is_owner: false,
                permissions: permissions
            })
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                showToast('error', 'خطأ', 'اسم المستخدم موجود بالفعل');
            } else {
                throw error;
            }
            return;
        }
        
        closeModal('modal-add-admin');
        showToast('success', 'تمت الإضافة', 'تم إضافة المسؤول بنجاح');
        loadAdmins();
        
    } catch (error) {
        console.error('Error adding admin:', error);
        showToast('error', 'خطأ', 'فشل إضافة المسؤول');
    }
}

function openEditAdminModal(adminId) {
    const admin = allAdmins.find(a => a.id === adminId);
    if (!admin) return;
    
    document.getElementById('edit-admin-id').value = adminId;
    document.getElementById('edit-admin-username').value = admin.username;
    document.getElementById('edit-admin-display-name').value = admin.display_name;
    document.getElementById('edit-admin-password').value = '';
    document.getElementById('edit-admin-current-photo-url').value = admin.photo_url || '';
    
    // ✅ عرض الصورة الحالية
    const preview = document.getElementById('edit-admin-photo-preview');
    if (admin.photo_url) {
        preview.innerHTML = `<img src="${admin.photo_url}" alt="${admin.display_name}">`;
        preview.classList.add('has-image');
        document.getElementById('edit-admin-remove-photo').style.display = 'inline-flex';
    } else {
        preview.innerHTML = '<i class="fas fa-user"></i>';
        preview.classList.remove('has-image');
        document.getElementById('edit-admin-remove-photo').style.display = 'none';
    }
    
    const permissions = admin.permissions || {};
    document.getElementById('edit-perm-view-complaints').checked = permissions.view_complaints || false;
    document.getElementById('edit-perm-reply-complaints').checked = permissions.reply_complaints || false;
    document.getElementById('edit-perm-mark-reviewed').checked = permissions.mark_reviewed || false;
    document.getElementById('edit-perm-search-students').checked = permissions.search_students || false;
    document.getElementById('edit-perm-review-accounts').checked = permissions.review_accounts || false;
    document.getElementById('edit-perm-manage-admins').checked = permissions.manage_admins || false;
    
    openModal('modal-edit-admin');
}

async function updateAdmin() {
    const adminId = document.getElementById('edit-admin-id').value;
    const username = document.getElementById('edit-admin-username').value.trim();
    const displayName = document.getElementById('edit-admin-display-name').value.trim();
    const password = document.getElementById('edit-admin-password').value;
    const photoFile = document.getElementById('edit-admin-photo-file').files[0];
    const currentPhotoUrl = document.getElementById('edit-admin-current-photo-url').value;
    
    if (!displayName) {
        showToast('warning', 'تنبيه', 'يُرجى إدخال الاسم الظاهر');
        return;
    }
    
    const permissions = {
        view_complaints: document.getElementById('edit-perm-view-complaints').checked,
        reply_complaints: document.getElementById('edit-perm-reply-complaints').checked,
        mark_reviewed: document.getElementById('edit-perm-mark-reviewed').checked,
        search_students: document.getElementById('edit-perm-search-students').checked,
        review_accounts: document.getElementById('edit-perm-review-accounts').checked,
        manage_admins: document.getElementById('edit-perm-manage-admins').checked
    };
    
    try {
        let photoUrl = currentPhotoUrl;
        
        // ✅ رفع صورة جديدة إذا تم اختيارها
        if (photoFile) {
            showToast('info', 'جارٍ الرفع', 'جارٍ رفع الصورة...');
            photoUrl = await uploadAdminPhoto(photoFile);
        }
        
        // التحقق إذا تم إزالة الصورة
        const preview = document.getElementById('edit-admin-photo-preview');
        if (!preview.classList.contains('has-image') && !photoFile) {
            photoUrl = null;
        }
        
        const updateData = {
            username: username,
            display_name: displayName,
            photo_url: photoUrl,
            permissions: permissions
        };
        
        if (password) {
            if (password.length < 6) {
                showToast('warning', 'تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }
            updateData.password_hash = password;
        }
        
        const { error } = await db
            .from('admins')
            .update(updateData)
            .eq('id', adminId);
        
        if (error) throw error;
        
        closeModal('modal-edit-admin');
        showToast('success', 'تم التحديث', 'تم تحديث بيانات المسؤول بنجاح');
        loadAdmins();
        
    } catch (error) {
        console.error('Error updating admin:', error);
        showToast('error', 'خطأ', 'فشل تحديث بيانات المسؤول');
    }
}

function deleteAdmin(adminId) {
    const admin = allAdmins.find(a => a.id === adminId);
    if (!admin || admin.is_owner) return;
    
    showConfirmModal(
        'تأكيد الحذف',
        `هل أنت متأكد من حذف المسؤول "${admin.display_name}"؟`,
        async () => {
            try {
                const { error } = await db
                    .from('admins')
                    .delete()
                    .eq('id', adminId);
                
                if (error) throw error;
                
                showToast('success', 'تم الحذف', 'تم حذف المسؤول بنجاح');
                loadAdmins();
                
            } catch (error) {
                console.error('Error deleting admin:', error);
                showToast('error', 'خطأ', 'فشل حذف المسؤول');
            }
        }
    );
}

// ============================================================
// ⚙️ الإعدادات
// ============================================================

async function loadSettings() {
    // ✅ تحميل بيانات الحساب الشخصي
    loadMyProfileData();
    
    // إظهار/إخفاء إعدادات النظام
    const systemSettings = document.getElementById('system-settings-section');
    if (systemSettings) {
        systemSettings.style.display = currentAdmin?.is_owner ? 'block' : 'none';
    }
    
    if (!currentAdmin?.is_owner) return;
    
    try {
        const { data: settings, error } = await db
            .from('settings')
            .select('*');
        
        if (error) throw error;
        
        settings?.forEach(setting => {
            switch (setting.key) {
                case 'allow_reregister_if_rejected':
                    document.getElementById('setting-allow-reregister').checked = setting.value === true || setting.value === 'true';
                    break;
                case 'spam_limit_messages':
                    document.getElementById('setting-spam-limit').value = setting.value || 5;
                    break;
                case 'spam_limit_minutes':
                    document.getElementById('setting-spam-minutes').value = setting.value || 5;
                    break;
                case 'spam_block_minutes':
                    document.getElementById('setting-block-minutes').value = setting.value || 5;
                    break;
                case 'admin_telegram_ids':
                    const ids = Array.isArray(setting.value) ? setting.value.join(', ') : '';
                    document.getElementById('setting-admin-telegram-ids').value = ids;
                    break;
            }
        });
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('error', 'خطأ', 'فشل تحميل الإعدادات');
    }
}

// ✅ تحميل بيانات الحساب الشخصي
function loadMyProfileData() {
    if (!currentAdmin) return;
    
    document.getElementById('my-display-name').value = currentAdmin.display_name || '';
    document.getElementById('my-username').value = currentAdmin.username || '';
    document.getElementById('my-current-password').value = '';
    document.getElementById('my-new-password').value = '';
    
    // تحميل الصورة الشخصية
    const photoPreview = document.getElementById('my-profile-photo');
    if (currentAdmin.photo_url) {
        photoPreview.innerHTML = `<img src="${currentAdmin.photo_url}" alt="${currentAdmin.display_name}">`;
    } else {
        photoPreview.innerHTML = '<i class="fas fa-user"></i>';
    }
}

// ✅ معاينة صورة الملف الشخصي
function previewMyPhoto(input) {
    const preview = document.getElementById('my-profile-photo');
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.size > 2 * 1024 * 1024) {
            showToast('warning', 'تنبيه', 'حجم الصورة يجب أن يكون أقل من 2MB');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="صورة">`;
        };
        reader.readAsDataURL(file);
    }
}

// ✅ حفظ بيانات الحساب الشخصي
async function saveMyProfile() {
    if (!currentAdmin) return;
    
    const displayName = document.getElementById('my-display-name').value.trim();
    const username = document.getElementById('my-username').value.trim();
    const currentPassword = document.getElementById('my-current-password').value;
    const newPassword = document.getElementById('my-new-password').value;
    const photoFile = document.getElementById('my-photo-upload').files[0];
    
    if (!displayName || !username) {
        showToast('warning', 'تنبيه', 'يُرجى ملء الحقول المطلوبة');
        return;
    }
    
    // التحقق من كلمة المرور الحالية إذا كان يريد تغيير كلمة المرور
    if (newPassword) {
        if (!currentPassword) {
            showToast('warning', 'تنبيه', 'يُرجى إدخال كلمة المرور الحالية');
            return;
        }
        
        if (currentPassword !== currentAdmin.password_hash) {
            showToast('error', 'خطأ', 'كلمة المرور الحالية غير صحيحة');
            return;
        }
        
        if (newPassword.length < 6) {
            showToast('warning', 'تنبيه', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
            return;
        }
    }
    
    try {
        let photoUrl = currentAdmin.photo_url;
        
        // رفع صورة جديدة إذا تم اختيارها
        if (photoFile) {
            showToast('info', 'جارٍ الرفع', 'جارٍ رفع الصورة...');
            photoUrl = await uploadAdminPhoto(photoFile);
        }
        
        const updateData = {
            display_name: displayName,
            username: username,
            photo_url: photoUrl
        };
        
        if (newPassword) {
            updateData.password_hash = newPassword;
        }
        
        const { error } = await db
            .from('admins')
            .update(updateData)
            .eq('id', currentAdmin.admin_id);
        
        if (error) {
            if (error.code === '23505') {
                showToast('error', 'خطأ', 'اسم المستخدم موجود بالفعل');
                return;
            }
            throw error;
        }
        
        // تحديث البيانات المحلية
        currentAdmin.display_name = displayName;
        currentAdmin.username = username;
        currentAdmin.photo_url = photoUrl;
        if (newPassword) {
            currentAdmin.password_hash = newPassword;
        }
        
        localStorage.setItem('admin_data', JSON.stringify(currentAdmin));
        updateAdminInfo();
        
        // إعادة تعيين الحقول
        document.getElementById('my-current-password').value = '';
        document.getElementById('my-new-password').value = '';
        document.getElementById('my-photo-upload').value = '';
        
        showToast('success', 'تم الحفظ', 'تم تحديث بياناتك بنجاح');
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('error', 'خطأ', 'فشل حفظ البيانات');
    }
}

async function updateSetting(key, value) {
    try {
        const { error } = await db
            .from('settings')
            .upsert({
                key: key,
                value: value,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        showToast('success', 'تم الحفظ', 'تم تحديث الإعداد بنجاح');
        
    } catch (error) {
        console.error('Error updating setting:', error);
        showToast('error', 'خطأ', 'فشل تحديث الإعداد');
    }
}

function updateAdminTelegramIds() {
    const input = document.getElementById('setting-admin-telegram-ids').value;
    const ids = input.split(',')
        .map(id => id.trim())
        .filter(id => id && !isNaN(id))
        .map(id => parseInt(id));
    
    updateSetting('admin_telegram_ids', ids);
}

// ============================================================
// 📡 الاشتراك في التحديثات الفورية
// ============================================================

function setupRealtimeSubscriptions() {
    db.channel('pending_users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_users' }, () => {
            loadAccountRequests();
            loadDashboardData();
        })
        .subscribe();
    
    db.channel('complaints_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
            loadComplaints();
            loadDashboardData();
        })
        .subscribe();
    
    db.channel('users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
            loadStudents();
            loadDashboardData();
        })
        .subscribe();
}

// ============================================================
// 🔲 إدارة النوافذ المنبثقة
// ============================================================

function openModal(modalId) {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
    document.body.style.overflow = '';
}

function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
    document.getElementById('confirm-message').textContent = message;
    
    document.getElementById('confirm-yes-btn').onclick = async () => {
        closeModal('modal-confirm');
        await onConfirm();
    };
    
    openModal('modal-confirm');
}

function openImageFullscreen(src) {
    document.getElementById('fullscreen-image').src = src;
    document.getElementById('modal-image-fullscreen').classList.add('active');
}

function closeImageFullscreen() {
    document.getElementById('modal-image-fullscreen').classList.remove('active');
}

// ============================================================
// 🔔 إشعارات Toast
// ============================================================

function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    
    const icons = {
        success: 'fa-check',
        error: 'fa-times',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================================
// 🛠️ الدوال المساعدة
// ============================================================

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getInitials(name) {
    if (!name) return '؟';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ============================================================
// ⌨️ اختصارات لوحة المفاتيح
// ============================================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllModals();
        closeImageFullscreen();
    }
});

// ============================================================
// 🔄 التحديث الدوري
// ============================================================

setInterval(() => {
    if (currentAdmin) {
        loadDashboardData();
    }
}, 30000);