// ==========================================
//  Patient Management App – app.js (UPDATED)
// ==========================================

// ----------------- STATE ------------------
let patientData = [];
let rowsPerPage = 50;
let currentPage = 1;
let currentEditPage = 1;
let filtered = null;

// Settings state
let autoSaveTimer = null;
let confirmDelete = true;
let exportFormat = 'xlsx';
let rememberTab = true;
let fontScale = 1;
let visibleColumns = {
    'รหัส': true,
    'ชื่อ - สกุล': true,
    'อายุ': true,
    'เบอร์โทร': true
};

// --------------- ELEMENTS -----------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const fileInput = $('#fileInput');
const dropLabel = $('#dropLabel');
const dataTableBody = $('#dataTable tbody');
const editTableBody = $('#editTable tbody');

// tabs
const tabList = $('#tab-list');
const tabEdit = $('#tab-edit');
const tabStats = $('#tab-stats');
const tabSettings = $('#tab-settings');

const panels = {
    list: $('#panel-list'),
    edit: $('#panel-edit'),
    stats: $('#panel-stats'),
    settings: $('#panel-settings')
};

// modal
const modal = $('#modal');
const modalTitle = $('#modalTitle');
const inputId = $('#inputId');
const inputName = $('#inputName');
const inputAge = $('#inputAge');
const inputPhone = $('#inputPhone');
const saveModal = $('#saveModal');

// stats
const statTotal = $('#stat-total');
const statAvg = $('#stat-avg');
const statOld = $('#stat-old');
const statYoung = $('#stat-young');
const statMissing = $('#stat-missing');
const statTotal2 = $('#stat-total-2');

// controls
const searchInput = $('#searchInput');
const addBtn = $('#addBtn');
const openAddModal = $('#openAddModal');
const prevPage = $('#prevPage');
const nextPage = $('#nextPage');
const pagerInfo = $('#pager-info');

// exports
const exportBtn = $('#exportBtn');
const exportCsvBtn = $('#exportCsv');

// settings controls
const autoSaveSelect = $('#autoSaveSelect');
const exportFormatSelect = $('#exportFormatSelect');
const confirmDeleteToggle = $('#confirmDeleteToggle');
const fontSizeSlider = $('#fontSizeSlider');
const fontSizeValue = $('#fontSizeValue');
const rememberTabToggle = $('#rememberTabToggle');
const showTipsToggle = $('#showTipsToggle');
const colToggles = $$('.col-toggle');
const rowsPerPageSelect = $('#rowsPerPageSelect');

// tips block
const tipsBlock = document.querySelector('.sidebar ol');

// --------------- UTILITIES ----------------
const sanitize = v => (v === undefined || v === null || v === '') ? '—' : String(v);
const generateId = () => String(Math.floor(10000 + Math.random() * 90000));
const debounce = (fn, delay = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; };

// -------------- TAB HANDLING ---------------
function setActiveTab(tab) {
    [tabList, tabEdit, tabStats, tabSettings].forEach(b => b.classList.remove('active'));
    tab.classList.add('active');

    Object.values(panels).forEach(p => p.style.display = 'none');
    if (tab === tabList) panels.list.style.display = 'block';
    if (tab === tabEdit) panels.edit.style.display = 'block';
    if (tab === tabStats) { panels.stats.style.display = 'block'; updateStats(); }
    if (tab === tabSettings) panels.settings.style.display = 'block';

    if (tab === tabList) renderTable();
    if (tab === tabEdit) renderEditTable();

    // remember tab
    if (rememberTab) localStorage.setItem('lastTab', tab.id);
}

tabList.onclick = () => setActiveTab(tabList);
tabEdit.onclick = () => setActiveTab(tabEdit);
tabStats.onclick = () => setActiveTab(tabStats);
tabSettings.onclick = () => setActiveTab(tabSettings);

// ----------- FILE HANDLING -----------------
['dragenter', 'dragover'].forEach(ev => {
    dropLabel.addEventListener(ev, e => { e.preventDefault(); dropLabel.textContent = 'ปล่อยเพื่ออัปโหลดไฟล์ .xlsx'; });
});
['dragleave', 'dragend', 'drop'].forEach(ev => {
    dropLabel.addEventListener(ev, e => { e.preventDefault(); dropLabel.textContent = '⇧ ลากไฟล์มาวาง หรือคลิกเพื่อเลือก'; });
});
dropLabel.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
dropLabel.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) handleFile(f); });

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheet];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            patientData = rows.map(r => ({
                'รหัสผู้ป่วย': r['รหัสผู้ป่วย'] ?? r['id'] ?? r['รหัส'] ?? generateId(),
                'ชื่อ - สกุล': r['ชื่อ - สกุล'] ?? r['name'] ?? '—',
                'อายุ': r['อายุ'] ?? r['age'] ?? '—',
                'เบอร์โทร': r['เบอร์โทร'] ?? r['phone'] ?? '—'
            }));
            currentPage = 1; currentEditPage = 1; filtered = null;
            safeUpdateUI(); setActiveTab(tabList);
        } catch (err) { alert('ไฟล์ไม่ถูกต้อง หรืออ่านไม่ได้'); console.error(err); }
    };
    reader.readAsArrayBuffer(file);
}

// ----------- TABLE RENDERERS ---------------
function applyColumnVisibility() {
    const visible = visibleColumns;
    const ths = $$('#dataTable thead th');
    ths.forEach(th => {
        const key = th.textContent.trim();
        if (visible[key] === false) th.style.display = 'none';
        else th.style.display = '';
    });
    const rows = $$('#dataTable tbody tr');
    rows.forEach(row => {
        row.querySelectorAll('td').forEach((td, i) => {
            const key = ths[i].textContent.trim();
            td.style.display = (visible[key] === false) ? 'none' : '';
        });
    });
}

function renderTable(isEdit = false) {
    const data = filtered || patientData;
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = data.slice(start, end);

    const tbody = isEdit ? editTableBody : dataTableBody;
    tbody.innerHTML = '';
    if (!pageData.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">ไม่มีข้อมูล</td></tr>';
        if (!isEdit) pagerInfo.textContent = 'หน้า 0 จาก 0';
        return;
    }

    pageData.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${sanitize(p['รหัสผู้ป่วย'])}</td>
                <td>${sanitize(p['ชื่อ - สกุล'])}</td>
                <td>${sanitize(p['อายุ'])}</td>
                <td>${sanitize(p['เบอร์โทร'])}</td>
                <td style='text-align:right' class='actions'>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='edit'>✏️ แก้ไข</button>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='delete'>🗑️ ลบ</button>
                </td>`;
        tbody.appendChild(tr);
    });

    if (!isEdit) {
        const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
        pagerInfo.textContent = `หน้า ${currentPage} จาก ${totalPages}`;
        applyColumnVisibility();
    }
}

function renderEditTable() {
    const data = patientData;
    const start = (currentEditPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = data.slice(start, end);

    editTableBody.innerHTML = '';
    if (!pageData.length) {
        editTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">ไม่มีข้อมูล</td></tr>';
        return;
    }

    pageData.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${sanitize(p['รหัสผู้ป่วย'])}</td>
                <td>${sanitize(p['ชื่อ - สกุล'])}</td>
                <td>${sanitize(p['อายุ'])}</td>
                <td>${sanitize(p['เบอร์โทร'])}</td>
                <td style='text-align:right' class='actions'>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='edit'>✏️ แก้ไข</button>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='delete'>🗑️ ลบ</button>
                </td>`;
        editTableBody.appendChild(tr);
    });
}

// ------------ PAGINATION -------------------
prevPage.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
nextPage.onclick = () => {
    const totalPages = Math.ceil((filtered || patientData).length / rowsPerPage);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
};

// --------------- SEARCH --------------------
searchInput.addEventListener('input', debounce(e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { filtered = null; currentPage = 1; renderTable(); return; }
    filtered = patientData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    currentPage = 1; renderTable();
}, 250));

// ----------- EDIT / DELETE -----------------
document.body.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.getAttribute('data-id');
    const act = b.getAttribute('data-act');
    if (act === 'delete') {
        if (confirmDelete) {
            if (!confirm('แน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
        }
        patientData = patientData.filter(p => String(p['รหัสผู้ป่วย']) !== String(id));
        safeUpdateUI();
    }
    if (act === 'edit') openModalForEdit(id);
});

// ---------------- MODAL --------------------
function openModalForEdit(id) {
    const p = patientData.find(x => String(x['รหัสผู้ป่วย']) === String(id));
    modalTitle.textContent = 'แก้ไขข้อมูล';
    inputId.value = p['รหัสผู้ป่วย'];
    inputName.value = p['ชื่อ - สกุล'] === '—' ? '' : p['ชื่อ - สกุล'];
    inputAge.value = (p['อายุ'] === '—') ? '' : p['อายุ'];
    inputPhone.value = (p['เบอร์โทร'] === '—') ? '' : p['เบอร์โทร'];
    modal.classList.add('show');
    saveModal.onclick = () => {
        p['ชื่อ - สกุล'] = inputName.value.trim() || '—';
        p['อายุ'] = inputAge.value.trim() || '—';
        p['เบอร์โทร'] = inputPhone.value.trim() || '—';
        modal.classList.remove('show');
        safeUpdateUI();
    };
}

function openModalForCreate() {
    modalTitle.textContent = 'เพิ่มคนไข้ใหม่';
    inputId.value = ''; inputName.value = ''; inputAge.value = ''; inputPhone.value = '';
    modal.classList.add('show');
    saveModal.onclick = () => {
        const id = inputId.value.trim() || generateId();
        const exists = patientData.some(x => String(x['รหัสผู้ป่วย']) === String(id));
        if (exists) { alert('รหัสนี้มีอยู่แล้ว'); return; }
        const rec = {
            'รหัสผู้ป่วย': id,
            'ชื่อ - สกุล': inputName.value.trim() || '—',
            'อายุ': inputAge.value.trim() || '—',
            'เบอร์โทร': inputPhone.value.trim() || '—'
        };
        patientData.unshift(rec);
        modal.classList.remove('show');
        safeUpdateUI();
        setActiveTab(tabList);
    };
}

$('#cancelModal').onclick = () => modal.classList.remove('show');
window.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('show'); });

// --------------- BUTTONS -------------------
addBtn.onclick = openModalForCreate;
openAddModal.onclick = openModalForCreate;
$('#clearBtn').onclick = () => {
    if (confirm('ต้องการล้างข้อมูลทั้งหมดหรือไม่?')) {
        patientData = [];
        localStorage.removeItem('patientData');
        safeUpdateUI();
    }
};

// --------------- EXPORT --------------------
exportBtn.onclick = () => {
    if (!patientData.length) return alert('ไม่มีข้อมูลให้ส่งออก');
    if (exportFormat === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(patientData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อคนไข้');
        XLSX.writeFile(wb, `patients_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else if (exportFormat === 'csv') {
        const rows = patientData.map(r => [r['รหัสผู้ป่วย'], r['ชื่อ - สกุล'], r['อายุ'], r['เบอร์โทร']]);
        const csv = [['รหัสผู้ป่วย', 'ชื่อ - สกุล', 'อายุ', 'เบอร์โทร'], ...rows]
            .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `patients_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    } else if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(patientData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `patients_${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); URL.revokeObjectURL(url);
    }
};

// --------------- STATS ---------------------
function updateStats() {
    const total = patientData.length;
    const ages = patientData.map(p => parseInt(p['อายุ'])).filter(n => !isNaN(n));
    statTotal.textContent = total;
    statTotal2.textContent = total;
    statAvg.textContent = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
    statOld.textContent = ages.length ? Math.max(...ages) : '—';
    statYoung.textContent = ages.length ? Math.min(...ages) : '—';
    statMissing.textContent = patientData.filter(p => !p['เบอร์โทร'] || p['เบอร์โทร'] === '—').length;
}

// --------- LOCAL SAVE / LOAD ---------------
function saveDataToLocal() {
    try {
        localStorage.setItem('patientData', JSON.stringify(patientData));
    } catch (e) {
        console.error('❌ Failed to save data:', e);
    }
}

function loadDataFromLocal() {
    try {
        const saved = localStorage.getItem('patientData');
        if (saved) {
            patientData = JSON.parse(saved);
            renderTable();
            renderEditTable();
            updateStats();
        }
    } catch (e) {
        console.error('❌ Failed to load data:', e);
    }
}

// ----------- UPDATE / SAVE -----------------
function safeUpdateUI() {
    renderTable();
    renderEditTable();
    updateStats();
    saveDataToLocal();
}

// --------------- SETTINGS ------------------

// auto-save
function startAutoSave(interval) {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    if (interval > 0) autoSaveTimer = setInterval(saveDataToLocal, interval);
}

// font size
function setFontScale(scale) {
    fontScale = scale;
    document.documentElement.style.setProperty('--font-scale', scale);
    fontSizeValue.textContent = Math.round(scale * 100) + '%';
}

// column visibility toggle
colToggles.forEach(chk => {
    chk.addEventListener('change', () => {
        visibleColumns[chk.value] = chk.checked;
        localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
        renderTable();
    });
});

// toggle tips
if (showTipsToggle) {
    showTipsToggle.addEventListener('change', () => {
        tipsBlock.style.display = showTipsToggle.checked ? '' : 'none';
        localStorage.setItem('showTips', showTipsToggle.checked ? '1' : '0');
    });
}

// confirm delete
if (confirmDeleteToggle) {
    confirmDeleteToggle.addEventListener('change', () => {
        confirmDelete = confirmDeleteToggle.checked;
        localStorage.setItem('confirmDelete', confirmDelete ? '1' : '0');
    });
}

// auto-save select
if (autoSaveSelect) {
    autoSaveSelect.addEventListener('change', () => {
        const val = parseInt(autoSaveSelect.value, 10);
        startAutoSave(val);
        localStorage.setItem('autoSaveInterval', val);
    });
}

// export format
if (exportFormatSelect) {
    exportFormatSelect.addEventListener('change', () => {
        exportFormat = exportFormatSelect.value;
        localStorage.setItem('exportFormat', exportFormat);
    });
}

// font-size slider
if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', () => {
        const val = parseInt(fontSizeSlider.value, 10) / 100;
        setFontScale(val);
        localStorage.setItem('fontScale', val);
    });
}

// remember tab
if (rememberTabToggle) {
    rememberTabToggle.addEventListener('change', () => {
        rememberTab = rememberTabToggle.checked;
        localStorage.setItem('rememberTab', rememberTab ? '1' : '0');
    });
}

// ------------ LOAD SETTINGS ----------------
(function loadSettings() {
    // auto-save
    const savedAuto = parseInt(localStorage.getItem('autoSaveInterval') || '30000', 10);
    autoSaveSelect.value = savedAuto;
    startAutoSave(savedAuto);

    // rows per page
    rowsPerPage = parseInt(localStorage.getItem('rowsPerPage') || '50', 10);
    rowsPerPageSelect.value = rowsPerPage;

    // export format
    exportFormat = localStorage.getItem('exportFormat') || 'xlsx';
    exportFormatSelect.value = exportFormat;

    // confirm delete
    confirmDelete = localStorage.getItem('confirmDelete') !== '0';
    confirmDeleteToggle.checked = confirmDelete;

    // font scale
    fontScale = parseFloat(localStorage.getItem('fontScale') || '1');
    fontSizeSlider.value = Math.round(fontScale * 100);
    setFontScale(fontScale);

    // remember tab
    rememberTab = localStorage.getItem('rememberTab') !== '0';
    rememberTabToggle.checked = rememberTab;

    // show tips
    const showTips = localStorage.getItem('showTips') !== '0';
    showTipsToggle.checked = showTips;
    tipsBlock.style.display = showTips ? '' : 'none';

    // column visibility
    const cols = JSON.parse(localStorage.getItem('visibleColumns') || '{}');
    visibleColumns = { ...visibleColumns, ...cols };
    colToggles.forEach(chk => { chk.checked = visibleColumns[chk.value] !== false; });

})();

if (rowsPerPageSelect) {
    rowsPerPageSelect.addEventListener('change', () => {
        rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
        localStorage.setItem('rowsPerPage', rowsPerPage);
        currentPage = 1;
        currentEditPage = 1;
        renderTable();
        renderEditTable();
    });
}

// ----------------- INIT --------------------
loadDataFromLocal();

// restore last tab if remembered
const lastTabId = localStorage.getItem('lastTab');
if (rememberTab && lastTabId && document.getElementById(lastTabId)) {
    setActiveTab(document.getElementById(lastTabId));
} else {
    setActiveTab(tabList);
}
