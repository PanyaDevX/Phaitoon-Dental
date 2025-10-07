// --- state ---
let patientData = [];
const rowsPerPage = 50;
let currentPage = 1;
let currentEditPage = 1;
let filtered = null;

// --- elements ---
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
const panels = {
    list: $('#panel-list'),
    edit: $('#panel-edit'),
    stats: $('#panel-stats')
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

// --- utilities ---
const sanitize = v => (v === undefined || v === null || v === '') ? '—' : String(v);
const generateId = () => String(Math.floor(10000 + Math.random() * 90000));
const debounce = (fn, delay = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; };

// --- set active tab ---
function setActiveTab(tab) {
    [tabList, tabEdit, tabStats].forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    panels.list.style.display = panels.edit.style.display = panels.stats.style.display = 'none';
    if (tab === tabList) panels.list.style.display = 'block';
    if (tab === tabEdit) panels.edit.style.display = 'block';
    if (tab === tabStats) panels.stats.style.display = 'block';
    if (tab === tabStats) updateStats();
    if (tab === tabList) renderTable();
    if (tab === tabEdit) renderEditTable();
}

// --- tab events ---
tabList.onclick = () => setActiveTab(tabList);
tabEdit.onclick = () => setActiveTab(tabEdit);
tabStats.onclick = () => setActiveTab(tabStats);

// --- file handling ---
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
                'เบอร์โทรศัพท์': r['เบอร์โทรศัพท์'] ?? r['phone'] ?? '—'
            }));
            currentPage = 1; currentEditPage = 1; filtered = null;
            safeUpdateUI(); setActiveTab(tabList);
        } catch (err) { alert('ไฟล์ไม่ถูกต้อง หรืออ่านไม่ได้'); console.error(err); }
    };
    reader.readAsArrayBuffer(file);
}

// --- shared table renderer ---
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
                <td>${sanitize(p['เบอร์โทรศัพท์'])}</td>
                <td style='text-align:right' class='actions'>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='edit'>✏️ แก้ไข</button>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='delete'>🗑️ ลบ</button>
                </td>`;
        tbody.appendChild(tr);
    });

    if (!isEdit) {
        const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
        pagerInfo.textContent = `หน้า ${currentPage} จาก ${totalPages}`;
    }
}

// --- renderEditTable (removed) ---
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
                <td>${sanitize(p['เบอร์โทรศัพท์'])}</td>
                <td style='text-align:right' class='actions'>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='edit'>✏️ แก้ไข</button>
                    <button class='pill' data-id='${p['รหัสผู้ป่วย']}' data-act='delete'>🗑️ ลบ</button>
                </td>`;
        editTableBody.appendChild(tr);
    });
}

// --- pagination (list tab) ---
prevPage.onclick = () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
};
nextPage.onclick = () => {
    const totalPages = Math.ceil((filtered || patientData).length / rowsPerPage);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
};

// --- search ---
searchInput.addEventListener('input', debounce(e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { filtered = null; currentPage = 1; renderTable(); return; }
    filtered = patientData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    currentPage = 1; renderTable();
}, 250));

// --- click handlers (edit/delete) ---
document.body.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.getAttribute('data-id');
    const act = b.getAttribute('data-act');
    if (act === 'delete') {
        if (confirm('แน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
            patientData = patientData.filter(p => String(p['รหัสผู้ป่วย']) !== String(id));
            safeUpdateUI();
        }
    }
    if (act === 'edit') openModalForEdit(id);
});

// --- modal ---
function openModalForEdit(id) {
    const p = patientData.find(x => String(x['รหัสผู้ป่วย']) === String(id));
    modalTitle.textContent = 'แก้ไขข้อมูล';
    inputId.value = p['รหัสผู้ป่วย'];
    inputName.value = p['ชื่อ - สกุล'] === '—' ? '' : p['ชื่อ - สกุล'];
    inputAge.value = (p['อายุ'] === '—') ? '' : p['อายุ'];
    inputPhone.value = (p['เบอร์โทรศัพท์'] === '—') ? '' : p['เบอร์โทรศัพท์'];
    modal.classList.add('show');
    saveModal.onclick = () => {
        p['ชื่อ - สกุล'] = inputName.value.trim() || '—';
        p['อายุ'] = inputAge.value.trim() || '—';
        p['เบอร์โทรศัพท์'] = inputPhone.value.trim() || '—';
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
            'เบอร์โทรศัพท์': inputPhone.value.trim() || '—'
        };
        patientData.unshift(rec);
        modal.classList.remove('show');
        safeUpdateUI();
        setActiveTab(tabList);
    };
}

$('#cancelModal').onclick = () => modal.classList.remove('show');
window.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('show'); });

// --- buttons ---
addBtn.onclick = openModalForCreate;
openAddModal.onclick = openModalForCreate;
$('#clearBtn').onclick = () => {
    if (confirm('ต้องการล้างข้อมูลทั้งหมดหรือไม่?')) {
        patientData = [];
        localStorage.removeItem('patientData');
        safeUpdateUI();
    }
};

// --- exports ---
exportBtn.onclick = () => {
    if (!patientData.length) return alert('ไม่มีข้อมูลให้ส่งออก');
    const ws = XLSX.utils.json_to_sheet(patientData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อคนไข้');
    XLSX.writeFile(wb, `patients_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
exportCsvBtn.onclick = () => {
    if (!patientData.length) return alert('ไม่มีข้อมูล');
    const rows = patientData.map(r => [r['รหัสผู้ป่วย'], r['ชื่อ - สกุล'], r['อายุ'], r['เบอร์โทรศัพท์']]);
    const csv = [['รหัสผู้ป่วย', 'ชื่อ - สกุล', 'อายุ', 'เบอร์โทรศัพท์'], ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `patients_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
};

// --- stats ---
function updateStats() {
    const total = patientData.length;
    const ages = patientData.map(p => parseInt(p['อายุ'])).filter(n => !isNaN(n));
    statTotal.textContent = total;
    statTotal2.textContent = total;
    statAvg.textContent = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
    statOld.textContent = ages.length ? Math.max(...ages) : '—';
    statYoung.textContent = ages.length ? Math.min(...ages) : '—';
    statMissing.textContent = patientData.filter(p => !p['เบอร์โทรศัพท์'] || p['เบอร์โทรศัพท์'] === '—').length;
}

// --- local save/load ---
function saveDataToLocal() {
    try {
        localStorage.setItem('patientData', JSON.stringify(patientData));
        console.log('✅ Data saved locally');
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
            console.log('📦 Loaded data from local storage');
        }
    } catch (e) {
        console.error('❌ Failed to load data:', e);
    }
}

// --- update/save ---
function safeUpdateUI() {
    renderTable();
    renderEditTable();
    updateStats();
    saveDataToLocal();
}

// --- init ---
loadDataFromLocal();
setActiveTab(tabList);