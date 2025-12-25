// script.js
// Main logic for Admin Dashboard (Supabase JS Client v2 - Vanilla JS, no modules)

// =========================
// 1. Supabase config
// =========================

// TODO: استبدل القيم دي ببيانات مشروع Supabase بتاعك
const SUPABASE_URL = "https://ysflfkuhzzvjzlhltkmw.supabase.co";
const SUPABASE_KEY = "sb_publishable_-QyQT7AFqaUDWpQOGy2CbQ_ObbbQpS9";

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    console.error("❌ Please set SUPABASE_URL and SUPABASE_KEY in script.js");
}

// نستخدم المكتبة من window.supabase (CDN)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================
// 2. Global state
// =========================

let currentAdmin = null;      // { id, username, full_name, role, permissions }
let currentRequest = null;    // selected pending user in modal
let currentComplaint = null;  // selected complaint in modal

// =========================
// 3. DOM elements
// =========================

const els = {};

function cacheDomElements() {
    els.loginSection = document.getElementById("login-section");
    els.loginForm = document.getElementById("login-form");
    els.loginError = document.getElementById("login-error");

    els.appSection = document.getElementById("app-section");

    els.topBarRight = document.getElementById("top-bar-right");

    // Tabs
    els.tabButtons = document.querySelectorAll(".tab-btn");
    els.tabRequests = document.getElementById("tab-requests");
    els.tabComplaints = document.getElementById("tab-complaints");
    els.tabStudents = document.getElementById("tab-students");
    els.tabAdmins = document.getElementById("tab-admins");

    els.tabBtnRequests = document.getElementById("tab-btn-requests");
    els.tabBtnComplaints = document.getElementById("tab-btn-complaints");
    els.tabBtnStudents = document.getElementById("tab-btn-students");
    els.tabBtnAdmins = document.getElementById("tab-btn-admins");

    // Requests
    els.requestsPermissionWarning = document.getElementById("requests-permission-warning");
    els.requestsTableWrapper = document.getElementById("requests-table-wrapper");
    els.requestsTbody = document.getElementById("requests-tbody");
    els.requestsEmpty = document.getElementById("requests-empty");

    // Complaints
    els.complaintsPermissionWarning = document.getElementById("complaints-permission-warning");
    els.complaintsTableWrapper = document.getElementById("complaints-table-wrapper");
    els.complaintsTbody = document.getElementById("complaints-tbody");
    els.complaintsEmpty = document.getElementById("complaints-empty");

    els.filterStatus = document.getElementById("filter-status");
    els.filterDate = document.getElementById("filter-date");
    els.filterYear = document.getElementById("filter-year");
    els.filterOrder = document.getElementById("filter-order");
    els.btnApplyFilters = document.getElementById("btn-apply-filters");

    // Students
    els.studentsPermissionWarning = document.getElementById("students-permission-warning");
    els.studentSearchForm = document.getElementById("student-search-form");
    els.searchQuery = document.getElementById("search-query");
    els.studentsResultsWrapper = document.getElementById("students-results-wrapper");
    els.studentsTbody = document.getElementById("students-tbody");
    els.studentsEmpty = document.getElementById("students-empty");

    // Admins
    els.adminsOwnerWarning = document.getElementById("admins-owner-warning");
    els.adminsContent = document.getElementById("admins-content");
    els.addAdminForm = document.getElementById("add-admin-form");
    els.adminFullName = document.getElementById("admin-full-name");
    els.adminUsername = document.getElementById("admin-username");
    els.adminPassword = document.getElementById("admin-password");
    els.adminRole = document.getElementById("admin-role");
    els.permViewComplaints = document.getElementById("perm-view-complaints");
    els.permReplyComplaints = document.getElementById("perm-reply-complaints");
    els.permMarkReviewed = document.getElementById("perm-mark-reviewed");
    els.permSearchStudents = document.getElementById("perm-search-students");
    els.permReviewAccounts = document.getElementById("perm-review-accounts");
    els.addAdminMessage = document.getElementById("add-admin-message");
    els.adminsTable = document.getElementById("admins-table");
    els.adminsTbody = document.getElementById("admins-tbody");
    els.adminsEmpty = document.getElementById("admins-empty");

    // Request modal
    els.requestModal = document.getElementById("request-modal");
    els.requestModalClose = document.getElementById("request-modal-close");
    els.requestModalBody = document.getElementById("request-modal-body");
    els.requestModalMessage = document.getElementById("request-modal-message");
    els.btnAcceptRequest = document.getElementById("btn-accept-request");
    els.btnRejectRequest = document.getElementById("btn-reject-request");

    // Complaint modal
    els.complaintModal = document.getElementById("complaint-modal");
    els.complaintModalClose = document.getElementById("complaint-modal-close");
    els.complaintModalBody = document.getElementById("complaint-modal-body");
    els.complaintReplySection = document.getElementById("complaint-reply-section");
    els.complaintReplyText = document.getElementById("complaint-reply-text");
    els.btnSaveReply = document.getElementById("btn-save-reply");
    els.btnMarkReviewed = document.getElementById("btn-mark-reviewed");
    els.complaintModalMessage = document.getElementById("complaint-modal-message");

    // Loader
    els.globalLoader = document.getElementById("global-loader");
}

// =========================
// 4. Helpers
// =========================

function showLoader() {
    if (els.globalLoader) els.globalLoader.style.display = "flex";
}
function hideLoader() {
    if (els.globalLoader) els.globalLoader.style.display = "none";
}

function formatDate(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        // Show local date/time
        return d.toLocaleString("ar-EG", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return isoString;
    }
}

function formatComplaintStatus(status) {
    const map = {
        new: "🔴 جديد",
        in_progress: "🟠 قيد المراجعة",
        replied: "🟢 تم الرد",
        reviewed: "🔵 تمت المراجعة",
        closed: "✅ مغلقة",
    };
    return map[status] || status || "غير معروف";
}

function formatPendingStatus(status) {
    const map = {
        pending: "⏳ قيد المراجعة",
        rejected: "⛔ مرفوض",
    };
    return map[status] || status || "غير معروف";
}

// Hash password using SHA-256 (for demo only; not production-grade)
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const arr = Array.from(new Uint8Array(digest));
    return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =========================
// 5. Session management
// =========================

function saveAdminSession(admin) {
    localStorage.setItem("adminSession", JSON.stringify(admin));
}

function loadAdminSession() {
    const raw = localStorage.getItem("adminSession");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function clearAdminSession() {
    localStorage.removeItem("adminSession");
}

// =========================
// 6. Login / Logout
// =========================

// الدالة العامة التي يستدعيها زر HTML: onclick="login()"
window.login = async function () {
    // في حالة عدم تهيئة العناصر (لو استُدعي قبل DOMContentLoaded لسبب ما)
    if (!els.loginForm || !els.loginError) {
        cacheDomElements();
    }

    const username = (els.loginForm.username?.value || "").trim();
    const password = (els.loginForm.password?.value || "").trim();

    els.loginError.style.display = "none";
    els.loginError.textContent = "";

    if (!username || !password) {
        els.loginError.textContent = "من فضلك اكتب اسم المستخدم وكلمة المرور.";
        els.loginError.style.display = "block";
        return;
    }

    try {
        showLoader();

        // Get admin by username
        const { data, error } = await supabase
            .from("admins")
            .select("*")
            .eq("username", username)
            .eq("is_active", true)
            .limit(1);

        if (error) throw error;
        if (!data || data.length === 0) {
            els.loginError.textContent = "بيانات الدخول غير صحيحة أو الحساب غير مفعّل.";
            els.loginError.style.display = "block";
            return;
        }

        const admin = data[0];

        // Compare SHA-256 hash of password with stored password_hash
        const hashed = await hashPassword(password);
        if (hashed !== admin.password_hash) {
            els.loginError.textContent = "بيانات الدخول غير صحيحة.";
            els.loginError.style.display = "block";
            return;
        }

        // Normalize permissions
        const permissions = admin.permissions || {};
        const normalizedPermissions = {
            view_complaints: !!permissions.view_complaints,
            reply_complaints: !!permissions.reply_complaints,
            mark_reviewed: !!permissions.mark_reviewed,
            search_students: !!permissions.search_students,
            review_accounts: !!permissions.review_accounts,
        };

        currentAdmin = {
            id: admin.id,
            username: admin.username,
            full_name: admin.full_name,
            role: admin.role,
            permissions: normalizedPermissions,
        };

        saveAdminSession(currentAdmin);

        // Switch UI
        enterAppMode();
    } catch (err) {
        console.error("Login error:", err);
        els.loginError.textContent = "حصل خطأ أثناء تسجيل الدخول. جرّب تاني.";
        els.loginError.style.display = "block";
    } finally {
        hideLoader();
    }
};

// معالجة إرسال الفورم (لو المستخدم ضغط Enter)
async function handleLoginSubmit(event) {
    console.log("LOGIN SUBMIT");
    event.preventDefault();
    await window.login();
}


function handleLogout() {
    clearAdminSession();
    currentAdmin = null;
    // Simplest: reload the page
    window.location.reload();
}

// =========================
// 7. Tabs logic
// =========================

function switchTab(tabId) {
    if (!tabId) return;

    // Deactivate all
    els.tabButtons.forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((tab) => {
        tab.classList.remove("active");
    });

    // Activate selected
    const btn = Array.from(els.tabButtons).find((b) => b.dataset.tab === tabId);
    if (btn) btn.classList.add("active");

    const content = document.getElementById(tabId);
    if (content) content.classList.add("active");
}

function activateFirstVisibleTab() {
    const visibleTabBtn = Array.from(els.tabButtons).find(
        (btn) => btn.style.display !== "none"
    );
    if (visibleTabBtn) {
        switchTab(visibleTabBtn.dataset.tab);
    }
}

// =========================
// 8. UI permissions & mode
// =========================

function enterAppMode() {
    if (!currentAdmin) return;

    // Hide login, show app
    els.loginSection.style.display = "none";
    els.appSection.style.display = "block";

    // Top bar info
    const roleLabel = currentAdmin.role === "owner" ? "مالك النظام" : "مسؤول";
    els.topBarRight.innerHTML = `
        <span>مرحباً، <strong>${currentAdmin.full_name}</strong> (${roleLabel})</span>
        <button id="btn-logout" class="btn btn-secondary small">تسجيل خروج</button>
    `;
    document
        .getElementById("btn-logout")
        .addEventListener("click", handleLogout);

    const perms = currentAdmin.permissions || {};

    // ---- Tabs visibility ----

    // Account Requests tab -> only if review_accounts permission OR owner
    const canReviewAccounts = currentAdmin.role === "owner" || perms.review_accounts;
    els.tabBtnRequests.style.display = canReviewAccounts ? "inline-block" : "none";
    els.tabRequests.style.display = canReviewAccounts ? "block" : "none";

    // Complaints tab -> visible if any complaint-related permission
    const canViewComplaints =
        perms.view_complaints || perms.reply_complaints || perms.mark_reviewed || currentAdmin.role === "owner";
    els.tabBtnComplaints.style.display = canViewComplaints ? "inline-block" : "none";
    els.tabComplaints.style.display = canViewComplaints ? "block" : "none";

    // Students tab -> only if search_students OR owner
    const canSearchStudents = currentAdmin.role === "owner" || perms.search_students;
    els.tabBtnStudents.style.display = canSearchStudents ? "inline-block" : "none";
    els.tabStudents.style.display = canSearchStudents ? "block" : "none";

    // Admins tab -> only for owner
    const isOwner = currentAdmin.role === "owner";
    els.tabBtnAdmins.style.display = isOwner ? "inline-block" : "none";
    els.tabAdmins.style.display = isOwner ? "block" : "none";

    // ---- Inside each tab ----

    // Requests tab
    if (!canReviewAccounts) {
        els.requestsPermissionWarning.style.display = "block";
        els.requestsTableWrapper.style.display = "none";
    } else {
        els.requestsPermissionWarning.style.display = "none";
        els.requestsTableWrapper.style.display = "block";
    }

    // Complaints tab
    if (!canViewComplaints) {
        els.complaintsPermissionWarning.style.display = "block";
        els.complaintsTableWrapper.style.display = "none";
    } else {
        els.complaintsPermissionWarning.style.display = "none";
        els.complaintsTableWrapper.style.display = "block";
    }

    // Students tab
    if (!canSearchStudents) {
        els.studentsPermissionWarning.style.display = "block";
        if (els.studentSearchForm) els.studentSearchForm.style.display = "none";
    } else {
        els.studentsPermissionWarning.style.display = "none";
        if (els.studentSearchForm) els.studentSearchForm.style.display = "flex";
    }

    // Admins tab
    if (!isOwner) {
        els.adminsOwnerWarning.style.display = "block";
        els.adminsContent.style.display = "none";
    } else {
        els.adminsOwnerWarning.style.display = "none";
        els.adminsContent.style.display = "block";
        // Load admins list
        loadAdmins();
    }

    // Default active tab
    activateFirstVisibleTab();

    // Load initial data
    if (canReviewAccounts) {
        loadPendingRequests();
    }
    if (canViewComplaints) {
        injectUnrepliedFilterOption();
        loadComplaints();
    }
}

// Add "Unreplied" option dynamically to status filter
function injectUnrepliedFilterOption() {
    if (!els.filterStatus) return;
    // avoid duplicating
    if (els.filterStatus.querySelector('option[value="unreplied"]')) return;
    const opt = document.createElement("option");
    opt.value = "unreplied";
    opt.textContent = "لم يتم الرد عليها";
    els.filterStatus.appendChild(opt);
}

// =========================
// 9. Pending Users (Account Requests)
// =========================

async function loadPendingRequests() {
    if (!currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canReviewAccounts = currentAdmin.role === "owner" || perms.review_accounts;
    if (!canReviewAccounts) return;

    try {
        showLoader();
        els.requestsTbody.innerHTML = "";
        els.requestsEmpty.style.display = "none";

        const { data, error } = await supabase
            .from("pending_users")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            els.requestsEmpty.style.display = "block";
            return;
        }

        data.forEach((req) => {
            const tr = document.createElement("tr");
            tr.dataset.id = req.id;

            const created_at = formatDate(req.created_at);

            tr.innerHTML = `
                <td>${req.full_name || ""}</td>
                <td>${req.student_code || ""}</td>
                <td>${req.year || ""}</td>
                <td>${req.phone || ""}</td>
                <td>${formatPendingStatus(req.status)}</td>
                <td>${created_at}</td>
            `;

            tr.addEventListener("click", () => openRequestModal(req));

            els.requestsTbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading pending requests:", err);
        alert("حصل خطأ أثناء تحميل طلبات التسجيل.");
    } finally {
        hideLoader();
    }
}

function openRequestModal(requestRecord) {
    currentRequest = requestRecord;
    els.requestModalMessage.textContent = "";

    const r = requestRecord;
    const created_at = formatDate(r.created_at);
    const updated_at = formatDate(r.updated_at);

    const sisPassword = r.sis_password || "";

    const html = `
        <div class="detail-row">
            <span class="detail-label">الاسم:</span>
            <span>${r.full_name || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">الكود الجامعي:</span>
            <span>${r.student_code || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">السنة الدراسية:</span>
            <span>${r.year || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">الموبايل:</span>
            <span>${r.phone || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">الرقم القومي:</span>
            <span>${r.national_id || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">كلمة مرور SIS:</span>
            <span>${sisPassword}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">حالة الطلب:</span>
            <span>${formatPendingStatus(r.status)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">السبب (في حالة الرفض):</span>
            <span>${r.rejection_reason || "-"}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">تاريخ الإنشاء:</span>
            <span>${created_at}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">آخر تحديث:</span>
            <span>${updated_at}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Telegram ID:</span>
            <span>${r.telegram_id || ""}</span>
        </div>
        ${
            r.id_photo_url
                ? `<div class="detail-row">
                    <span class="detail-label">صورة البطاقة / الكارنيه:</span>
                    <img src="${r.id_photo_url}" alt="ID Photo" class="id-photo-preview" />
                </div>`
                : ""
        }
    `;

    els.requestModalBody.innerHTML = html;

    // Ensure buttons visible only if admin has permission
    const perms = currentAdmin.permissions || {};
    const canReviewAccounts = currentAdmin.role === "owner" || perms.review_accounts;
    els.btnAcceptRequest.disabled = !canReviewAccounts;
    els.btnRejectRequest.disabled = !canReviewAccounts;

    els.requestModal.style.display = "flex";
}

function closeRequestModal() {
    els.requestModal.style.display = "none";
    currentRequest = null;
    els.requestModalBody.innerHTML = "";
}

async function handleAcceptRequest() {
    if (!currentRequest || !currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canReviewAccounts = currentAdmin.role === "owner" || perms.review_accounts;
    if (!canReviewAccounts) {
        els.requestModalMessage.textContent =
            "ليس لديك صلاحية قبول / رفض الطلبات.";
        return;
    }

    const confirmed = confirm(
        "هل أنت متأكد من قبول هذا الطالب ونقله إلى جدول users؟"
    );
    if (!confirmed) return;

    try {
        showLoader();
        els.requestModalMessage.textContent = "";

        const r = currentRequest;

        // 1) Insert into users
        const newUser = {
            telegram_id: r.telegram_id,
            full_name: r.full_name,
            student_code: r.student_code,
            phone: r.phone,
            year: r.year,
            national_id: r.national_id,
            id_photo_url: r.id_photo_url,
            status: "active",
        };

        const { data: insertedUsers, error: insertError } = await supabase
            .from("users")
            .insert(newUser)
            .select()
            .single();

        if (insertError) throw insertError;

        // 2) Delete from pending_users
        const { error: deleteError } = await supabase
            .from("pending_users")
            .delete()
            .eq("id", r.id);

        if (deleteError) throw deleteError;

        els.requestModalMessage.textContent =
            "✅ تم قبول الطالب ونقله إلى جدول users.";
        // Reload table
        await loadPendingRequests();
        // إغلاق المودال بعد ثواني بسيطة
        setTimeout(() => closeRequestModal(), 800);
    } catch (err) {
        console.error("Error accepting request:", err);
        els.requestModalMessage.textContent =
            "❌ حصل خطأ أثناء قبول الطلب. جرّب تاني.";
    } finally {
        hideLoader();
    }
}

async function handleRejectRequest() {
    if (!currentRequest || !currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canReviewAccounts = currentAdmin.role === "owner" || perms.review_accounts;
    if (!canReviewAccounts) {
        els.requestModalMessage.textContent =
            "ليس لديك صلاحية قبول / رفض الطلبات.";
        return;
    }

    const reason = prompt(
        "اكتب سبب الرفض (اختياري - هيظهر للطالب في رسالة الرفض):"
    );
    const confirmed = confirm("هل أنت متأكد من رفض هذا الطلب؟");
    if (!confirmed) return;

    try {
        showLoader();
        els.requestModalMessage.textContent = "";

        // نحدّث الـ status إلى rejected ونحط سبب الرفض
        // (البوت في تيليجرام بيراقب UPDATE على pending_users عشان يبعث إشعار رفض)
        const { data, error } = await supabase
            .from("pending_users")
            .update({
                status: "rejected",
                rejection_reason: reason || null,
            })
            .eq("id", currentRequest.id)
            .select()
            .single();

        if (error) throw error;

        els.requestModalMessage.textContent =
            "⛔ تم رفض الطلب وتحديث حالته إلى 'مرفوض'.";
        // Reload table (الطلبات pending بس)
        await loadPendingRequests();
        setTimeout(() => closeRequestModal(), 800);
    } catch (err) {
        console.error("Error rejecting request:", err);
        els.requestModalMessage.textContent =
            "❌ حصل خطأ أثناء رفض الطلب. جرّب تاني.";
    } finally {
        hideLoader();
    }
}

// =========================
// 10. Complaints Management
// =========================

async function loadComplaints() {
    if (!currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canView =
        perms.view_complaints || perms.reply_complaints || perms.mark_reviewed || currentAdmin.role === "owner";
    if (!canView) return;

    try {
        showLoader();
        els.complaintsTbody.innerHTML = "";
        els.complaintsEmpty.style.display = "none";

        const statusFilter = els.filterStatus.value || "all";
        const dateFilter = els.filterDate.value || "all";
        const yearFilter = els.filterYear.value || "all";
        const orderFilter = els.filterOrder.value || "newest";

        let query = supabase.from("complaints").select("*");

        // Status/Unreplied filter
        if (statusFilter === "unreplied") {
            // admin_reply is null
            query = query.is("admin_reply", null);
        } else if (statusFilter !== "all") {
            query = query.eq("status", statusFilter);
        }

        // Year filter
        if (yearFilter !== "all") {
            const y = parseInt(yearFilter, 10);
            if (!isNaN(y)) {
                query = query.eq("year", y);
            }
        }

        // Date filters: today / this week
        const now = new Date();
        if (dateFilter === "today") {
            const start = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0,
                0,
                0
            );
            query = query.gte("created_at", start.toISOString());
        } else if (dateFilter === "week") {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query = query.gte("created_at", sevenDaysAgo.toISOString());
        }

        // Order
        const ascending = orderFilter === "oldest";
        query = query.order("created_at", { ascending });

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            els.complaintsEmpty.style.display = "block";
            return;
        }

        data.forEach((c) => {
            const tr = document.createElement("tr");
            tr.dataset.id = c.id;

            tr.innerHTML = `
                <td>${c.ticket_number || ""}</td>
                <td>${c.full_name || ""}</td>
                <td>${c.student_code || ""}</td>
                <td>${c.year || ""}</td>
                <td>${formatComplaintStatus(c.status)}</td>
                <td>${formatDate(c.created_at)}</td>
            `;

            tr.addEventListener("click", () => openComplaintModal(c));

            els.complaintsTbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading complaints:", err);
        alert("حصل خطأ أثناء تحميل الشكاوي.");
    } finally {
        hideLoader();
    }
}

function openComplaintModal(complaint) {
    currentComplaint = complaint;
    els.complaintModalMessage.textContent = "";
    els.complaintReplyText.value = "";

    const c = complaint;
    const created = formatDate(c.created_at);
    const replied = formatDate(c.replied_at);
    const reviewed = formatDate(c.reviewed_at);

    const isOwner = currentAdmin && currentAdmin.role === "owner";

    const html = `
        <div class="detail-row">
            <span class="detail-label">رقم التذكرة:</span>
            <span>${c.ticket_number || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">اسم الطالب:</span>
            <span>${c.full_name || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">الكود الجامعي:</span>
            <span>${c.student_code || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">السنة الدراسية:</span>
            <span>${c.year || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Telegram ID:</span>
            <span>${c.telegram_id || ""}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">حالة الشكوى:</span>
            <span>${formatComplaintStatus(c.status)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">تاريخ الإرسال:</span>
            <span>${created}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">تم الرد في:</span>
            <span>${c.admin_reply ? replied : "-"}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">تمت المراجعة في:</span>
            <span>${c.is_reviewed ? reviewed : "-"}</span>
        </div>
        <hr />
        <div class="detail-row">
            <span class="detail-label">نص الشكوى:</span>
        </div>
        <p>${(c.content || "").replace(/\n/g, "<br>")}</p>
        ${
            c.admin_reply
                ? `
        <hr />
        <div class="detail-row">
            <span class="detail-label">رد المسؤول:</span>
        </div>
        <p>${(c.admin_reply || "").replace(/\n/g, "<br>")}</p>
        `
                : ""
        }
        ${
            isOwner && c.replied_by_admin_name
                ? `
        <div class="detail-row">
            <span class="detail-label">تم الرد بواسطة:</span>
            <span>${c.replied_by_admin_name}</span>
        </div>
        `
                : ""
        }
    `;

    els.complaintModalBody.innerHTML = html;

    // Permissions for reply/review
    const perms = currentAdmin.permissions || {};
    const canReply = currentAdmin.role === "owner" || perms.reply_complaints;
    const canMarkReviewed = currentAdmin.role === "owner" || perms.mark_reviewed;

    if (!canReply && !canMarkReviewed) {
        els.complaintReplySection.style.display = "none";
    } else {
        els.complaintReplySection.style.display = "block";
        els.btnSaveReply.disabled = !canReply;
        els.btnMarkReviewed.disabled = !canMarkReviewed;
    }

    els.complaintModal.style.display = "flex";
}

function closeComplaintModal() {
    els.complaintModal.style.display = "none";
    currentComplaint = null;
    els.complaintModalBody.innerHTML = "";
}

async function handleSaveReply() {
    if (!currentComplaint || !currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canReply = currentAdmin.role === "owner" || perms.reply_complaints;
    if (!canReply) {
        els.complaintModalMessage.textContent =
            "ليس لديك صلاحية الرد على الشكاوي.";
        return;
    }

    const replyText = els.complaintReplyText.value.trim();
    if (!replyText) {
        els.complaintModalMessage.textContent =
            "من فضلك اكتب نص الرد قبل الحفظ.";
        return;
    }

    const confirmed = confirm("هل تريد حفظ هذا الرد وإرساله للطالب؟");
    if (!confirmed) return;

    try {
        showLoader();
        els.complaintModalMessage.textContent = "";

        const nowIso = new Date().toISOString();

        const { data, error } = await supabase
            .from("complaints")
            .update({
                admin_reply: replyText,
                status: "replied",
                replied_at: nowIso,
                replied_by_admin_id: currentAdmin.id,
                replied_by_admin_name: currentAdmin.full_name,
            })
            .eq("id", currentComplaint.id)
            .select()
            .single();

        if (error) throw error;

        els.complaintModalMessage.textContent =
            "✅ تم حفظ الرد بنجاح وسيتم إرسال إشعار للطالب.";
        currentComplaint = data;

        // إعادة تحميل الجدول وتحديث المودال
        await loadComplaints();
        openComplaintModal(data);
    } catch (err) {
        console.error("Error saving complaint reply:", err);
        els.complaintModalMessage.textContent =
            "❌ حصل خطأ أثناء حفظ الرد. جرّب تاني.";
    } finally {
        hideLoader();
    }
}

async function handleMarkReviewed() {
    if (!currentComplaint || !currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canMarkReviewed = currentAdmin.role === "owner" || perms.mark_reviewed;
    if (!canMarkReviewed) {
        els.complaintModalMessage.textContent =
            "ليس لديك صلاحية وضع علامة تمت المراجعة.";
        return;
    }

    const confirmed = confirm(
        "هل تريد وضع علامة (تمت المراجعة) على هذه الشكوى؟"
    );
    if (!confirmed) return;

    try {
        showLoader();
        els.complaintModalMessage.textContent = "";

        const nowIso = new Date().toISOString();

        const { data, error } = await supabase
            .from("complaints")
            .update({
                is_reviewed: true,
                reviewed_at: nowIso,
                status: currentComplaint.status === "replied" ? "reviewed" : currentComplaint.status,
            })
            .eq("id", currentComplaint.id)
            .select()
            .single();

        if (error) throw error;

        els.complaintModalMessage.textContent =
            "✅ تم وضع علامة (تمت المراجعة) بنجاح.";
        currentComplaint = data;

        await loadComplaints();
        openComplaintModal(data);
    } catch (err) {
        console.error("Error marking complaint reviewed:", err);
        els.complaintModalMessage.textContent =
            "❌ حصل خطأ أثناء تحديث حالة الشكوى.";
    } finally {
        hideLoader();
    }
}

// =========================
// 11. Student Search
// =========================

async function handleStudentSearch(event) {
    event.preventDefault();
    if (!currentAdmin) return;
    const perms = currentAdmin.permissions || {};
    const canSearch = currentAdmin.role === "owner" || perms.search_students;
    if (!canSearch) {
        alert("ليس لديك صلاحية البحث عن الطلاب.");
        return;
    }

    const q = els.searchQuery.value.trim();
    els.studentsTbody.innerHTML = "";
    els.studentsEmpty.style.display = "none";
    els.studentsResultsWrapper.style.display = "none";

    if (!q) {
        els.studentsEmpty.textContent = "من فضلك اكتب الاسم أو الكود الجامعي.";
        els.studentsEmpty.style.display = "block";
        return;
    }

    try {
        showLoader();

        // Search by student_code OR full_name
        // Using ilike for partial matching
        const { data, error } = await supabase
            .from("users")
            .select("full_name, student_code, year, phone, national_id")
            .or(
                `student_code.ilike.%${q}%,full_name.ilike.%${q}%`
            )
            .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
            els.studentsEmpty.textContent = "لا يوجد طلاب مطابقين لنتيجة البحث.";
            els.studentsEmpty.style.display = "block";
            return;
        }

        data.forEach((u) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${u.full_name || ""}</td>
                <td>${u.student_code || ""}</td>
                <td>${u.year || ""}</td>
                <td>${u.phone || ""}</td>
                <td>${u.national_id || ""}</td>
            `;
            els.studentsTbody.appendChild(tr);
        });

        els.studentsResultsWrapper.style.display = "block";
    } catch (err) {
        console.error("Error searching students:", err);
        alert("حصل خطأ أثناء البحث عن الطلاب.");
    } finally {
        hideLoader();
    }
}

// =========================
// 12. Admins Management (Owner only)
// =========================

async function loadAdmins() {
    if (!currentAdmin || currentAdmin.role !== "owner") return;

    try {
        showLoader();
        els.adminsTbody.innerHTML = "";
        els.adminsEmpty.style.display = "none";

        const { data, error } = await supabase
            .from("admins")
            .select("id, full_name, username, role, is_active")
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            els.adminsEmpty.style.display = "block";
            return;
        }

        data.forEach((a) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${a.full_name || ""}</td>
                <td>${a.username || ""}</td>
                <td>${a.role || ""}</td>
                <td>${a.is_active ? "✅ مفعّل" : "⛔ غير مفعّل"}</td>
            `;
            els.adminsTbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading admins:", err);
    } finally {
        hideLoader();
    }
}

async function handleAddAdmin(event) {
    event.preventDefault();
    if (!currentAdmin || currentAdmin.role !== "owner") {
        alert("هذه الصفحة متاحة فقط لمالك النظام (Owner).");
        return;
    }

    const fullName = els.adminFullName.value.trim();
    const username = els.adminUsername.value.trim();
    const password = els.adminPassword.value.trim();
    const role = els.adminRole.value || "admin";

    els.addAdminMessage.textContent = "";

    if (!fullName || !username || !password) {
        els.addAdminMessage.textContent =
            "من فضلك أكمل جميع البيانات (الاسم، اسم المستخدم، كلمة المرور).";
        return;
    }

    try {
        showLoader();

        // Check if username already exists
        const { data: existing, error: checkError } = await supabase
            .from("admins")
            .select("id")
            .eq("username", username)
            .limit(1);

        if (checkError) throw checkError;
        if (existing && existing.length > 0) {
            els.addAdminMessage.textContent =
                "اسم المستخدم مستخدم بالفعل. اختر اسم آخر.";
            return;
        }

        const password_hash = await hashPassword(password);
        const permissions = {
            view_complaints: els.permViewComplaints.checked,
            reply_complaints: els.permReplyComplaints.checked,
            mark_reviewed: els.permMarkReviewed.checked,
            search_students: els.permSearchStudents.checked,
            review_accounts: els.permReviewAccounts.checked,
        };

        const { error: insertError } = await supabase.from("admins").insert({
            full_name: fullName,
            username,
            password_hash,
            role,
            permissions,
            is_active: true,
        });

        if (insertError) throw insertError;

        els.addAdminMessage.textContent = "✅ تم إضافة المسؤول بنجاح.";
        els.addAdminForm.reset();
        // Reload admins list
        await loadAdmins();
    } catch (err) {
        console.error("Error adding admin:", err);
        els.addAdminMessage.textContent =
            "❌ حصل خطأ أثناء إضافة المسؤول. جرّب تاني.";
    } finally {
        hideLoader();
    }
}

// =========================
// 13. Event bindings
// =========================

function bindEvents() {
    if (els.loginForm) {
        els.loginForm.addEventListener("submit", handleLoginSubmit);
    }

    console.log("bindEvents loaded");

    // Tabs
    els.tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });

    // Requests modal
    if (els.requestModalClose) {
        els.requestModalClose.addEventListener("click", closeRequestModal);
    }
    if (els.btnAcceptRequest) {
        els.btnAcceptRequest.addEventListener("click", handleAcceptRequest);
    }
    if (els.btnRejectRequest) {
        els.btnRejectRequest.addEventListener("click", handleRejectRequest);
    }

    // Complaint modal
    if (els.complaintModalClose) {
        els.complaintModalClose.addEventListener("click", closeComplaintModal);
    }
    if (els.btnSaveReply) {
        els.btnSaveReply.addEventListener("click", handleSaveReply);
    }
    if (els.btnMarkReviewed) {
        els.btnMarkReviewed.addEventListener("click", handleMarkReviewed);
    }

    // Filters
    if (els.btnApplyFilters) {
        els.btnApplyFilters.addEventListener("click", () => {
            loadComplaints();
        });
    }

    // Student search
    if (els.studentSearchForm) {
        els.studentSearchForm.addEventListener("submit", handleStudentSearch);
    }

    // Close modals when clicking outside content (optional)
    if (els.requestModal) {
        els.requestModal.addEventListener("click", (e) => {
            if (e.target === els.requestModal) {
                closeRequestModal();
            }
        });
    }
    if (els.complaintModal) {
        els.complaintModal.addEventListener("click", (e) => {
            if (e.target === els.complaintModal) {
                closeComplaintModal();
            }
        });
    }
}

// =========================
// 14. Init
// =========================

document.addEventListener("DOMContentLoaded", () => {
    cacheDomElements();
    bindEvents();

    const session = loadAdminSession();
    if (session) {
        currentAdmin = session;
        enterAppMode();
    } else {
        // Show login section
        els.loginSection.style.display = "block";
        els.appSection.style.display = "none";
    }
});