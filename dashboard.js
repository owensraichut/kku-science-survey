// ====================================================================
// TEACHER DASHBOARD LOGIC
// ====================================================================

let supabaseClient = null;
let allSurveys = [];      // ข้อมูลผู้ลงทะเบียนทั้งหมดในหน่วยความจำ
let filteredSurveys = []; // ข้อมูลที่ผ่านการค้นหา/ฟิลเตอร์แล้ว

// ตัวแปรเก็บ Instance ของกราฟ Chart.js เพื่อรีเซ็ตเวลาอัปเดตข้อมูล
let barChartInstance = null;
let gradeChartInstance = null;
let branchChartInstance = null;

// รายชื่อกิจกรรมสำหรับอ้างอิงและทำกราฟ
const ACTIVITY_NAMES = {
    1: "1. โครงงานวิทยาศาสตร์ ม.ปลาย",
    2: "2. ตอบปัญหาวิทยาศาสตร์ ม.ปลาย",
    3: "3. แก้ปัญหาทางวิทยาศาสตร์ ม.ปลาย",
    4: "4. แก้ปัญหาคณิตศาสตร์ ม.ปลาย",
    5: "5. วาดภาพจินตนาการทางวิทย์ ม.ปลาย",
    6: "6. การสื่อสารทางวิทยาศาสตร์",
    7: "7. การประกวด Science Show ม.ต้น",
    8: "8. แข่งขันจรวดขวดน้ำ",
    9: "9. แข่งขันเครื่องบินกระดาษพับ",
    10: "10. ประกวดสิ่งประดิษฐ์จากของเสีย"
};

// ตรวจเช็คสิทธิ์ล็อกอินเมื่อเปิดหน้านี้
document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
});

/**
 * 1. ระบบรักษาความปลอดภัยหน้าควบคุม (Passcode Gate)
 */
function checkAuthentication() {
    const isAuthenticated = sessionStorage.getItem("admin_authenticated");
    if (isAuthenticated === "true") {
        document.getElementById("passwordGate").style.display = "none";
        document.getElementById("dashboardContent").style.display = "block";
        initDashboard();
    }
}

function validatePasscode() {
    const passcode = document.getElementById("adminPasscode").value;
    const errorDiv = document.getElementById("passcodeError");
    
    // ตั้งรหัสผ่านเริ่มต้นเป็น 1234
    if (passcode === "1234") {
        sessionStorage.setItem("admin_authenticated", "true");
        document.getElementById("passwordGate").style.display = "none";
        document.getElementById("dashboardContent").style.display = "block";
        initDashboard();
    } else {
        errorDiv.style.display = "block";
        document.getElementById("adminPasscode").value = "";
    }
}

// ผูกฟังก์ชันกด Enter ในช่องพาสเวิร์ด
document.getElementById("adminPasscode").addEventListener("keypress", (e) => {
    if (e.key === 'Enter') {
        validatePasscode();
    }
});

/**
 * 2. เริ่มต้นระบบจัดการข้อมูลในแดชบอร์ด
 */
async function initDashboard() {
    initDatabase();
    await fetchSurveyData();
}

function initDatabase() {
    const statusBanner = document.getElementById("connectionStatus");
    const statusText = document.getElementById("statusText");

    if (isSupabaseConfigured()) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
            statusBanner.className = "status-banner supabase-active";
            statusText.innerText = "เชื่อมต่อระบบฐานข้อมูล Supabase สำเร็จ (ข้อมูลออนไลน์)";
        } catch (error) {
            console.error("Supabase Connection Error:", error);
            setupFallbackMode("เชื่อมต่อฐานข้อมูลไม่สำเร็จ! ดึงข้อมูลจำลองจาก LocalStorage");
        }
    } else {
        setupFallbackMode("รันในโหมดจำลอง (LocalStorage Demo) - ข้อมูลและสถิติจะดึงจากเครื่องนี้");
    }
}

function setupFallbackMode(message) {
    supabaseClient = null;
    const statusBanner = document.getElementById("connectionStatus");
    const statusText = document.getElementById("statusText");
    
    statusBanner.className = "status-banner local-demo";
    statusText.innerText = message;
}

/**
 * 3. ดึงข้อมูลจากฐานข้อมูล
 */
async function fetchSurveyData() {
    try {
        if (supabaseClient) {
            // ดึงข้อมูลจริงจาก Supabase เรียงลำดับจากสร้างก่อน-หลัง
            const { data, error } = await supabaseClient
                .from("student_surveys")
                .select("*")
                .order('id', { ascending: false });

            if (error) throw error;
            allSurveys = data || [];
        } else {
            // ดึงข้อมูลจาก LocalStorage
            let localData = localStorage.getItem("student_surveys");
            allSurveys = localData ? JSON.parse(localData) : [];
            // เรียงลำดับย้อนหลังเพื่อให้ข้อมูลล่าสุดขึ้นก่อน
            allSurveys.reverse();
        }

        // นำข้อมูลไปคำนวณและแสดงผล
        filteredSurveys = [...allSurveys];
        updateMetricsAndCharts();
        renderDataTable();
        
    } catch (error) {
        console.error("Fetch Data Error:", error);
        showToast("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลแบบสำรวจได้: " + error.message, "error");
    }
}

/**
 * 4. คำนวณสถิติและอัปเดตกราฟทั้งหมด
 */
function updateMetricsAndCharts() {
    // 4.1 คำนวณสถิติตัวเลข (Metrics)
    const totalStudents = filteredSurveys.length;
    let juniorCount = 0;
    let seniorCount = 0;

    // โครงสร้างสำหรับนับสถิติตามกิจกรรม
    const activityCounts = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0 };
    
    // โครงสร้างสถิติแยกตามชั้นเรียน
    const gradeCounts = { "ม.1":0, "ม.2":0, "ม.3":0, "ม.4":0, "ม.5":0, "ม.6":0 };
    
    // โครงสร้างสถิติสาขาโครงงาน ม.ปลาย
    const branchCounts = { "สาขากายภาพ":0, "สาขาชีวภาพ":0, "สาขาวิทยาศาสตร์ประยุกต์":0 };

    filteredSurveys.forEach(survey => {
        const isJunior = ["ม.1", "ม.2", "ม.3"].includes(survey.class_level);
        
        if (isJunior) {
            juniorCount++;
        } else {
            seniorCount++;
        }

        // นับสถิติรายห้องเรียน / ชั้นเรียน
        if (gradeCounts.hasOwnProperty(survey.class_level)) {
            gradeCounts[survey.class_level]++;
        }

        // นับความสนใจในรายกิจกรรม
        if (survey.interests && Array.isArray(survey.interests)) {
            survey.interests.forEach(interest => {
                const actId = interest.id;
                if (activityCounts.hasOwnProperty(actId)) {
                    activityCounts[actId]++;
                }
                
                // สำหรับโครงงานวิทยาศาสตร์
                if (actId === 1 && interest.branch) {
                    if (branchCounts.hasOwnProperty(interest.branch)) {
                        branchCounts[interest.branch]++;
                    }
                }
            });
        }
    });

    // แสดงผลตัวเลขในหน้า HTML
    document.getElementById("metricTotalStudents").innerText = totalStudents;
    document.getElementById("metricJuniorEnrollments").innerText = juniorCount;
    document.getElementById("metricSeniorEnrollments").innerText = seniorCount;

    // 4.2 วาดกราฟแท่ง (Bar Chart) - จำนวนคนในแต่ละกิจกรรม
    drawActivitiesChart(activityCounts);

    // 4.3 วาดกราฟ Doughnut - สัดส่วนตามระดับชั้นเรียน
    drawGradesChart(gradeCounts);

    // 4.4 วาดกราฟ Doughnut - สัดส่วนสาขาโครงงานวิทยาศาสตร์
    drawBranchesChart(branchCounts);
}

/**
 * 4.2 ฟังก์ชันวาดกราฟแท่ง (Bar Chart) ความสนใจ 10 รายการ
 */
function drawActivitiesChart(activityCounts) {
    const ctx = document.getElementById("activitiesBarChart").getContext("2d");
    
    if (barChartInstance) {
        barChartInstance.destroy();
    }

    const labels = Object.keys(ACTIVITY_NAMES).map(key => ACTIVITY_NAMES[key]);
    const dataValues = Object.keys(activityCounts).map(key => activityCounts[key]);

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนนักเรียน (คน)',
                data: dataValues,
                backgroundColor: [
                    'rgba(79, 70, 229, 0.7)',  // Indigo
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(129, 140, 248, 0.7)',
                    'rgba(165, 180, 252, 0.7)',
                    'rgba(249, 115, 22, 0.7)',  // Orange
                    'rgba(251, 146, 60, 0.7)',
                    'rgba(14, 165, 233, 0.7)',  // Sky
                    'rgba(16, 185, 129, 0.7)',  // Emerald
                    'rgba(245, 158, 11, 0.7)',  // Amber
                    'rgba(239, 68, 68, 0.7)'    // Red
                ],
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: { family: 'Sarabun' },
                    bodyFont: { family: 'Sarabun' }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Sarabun', size: 10 },
                        // ย่อชื่อยาวๆ เพื่อไม่ให้เบียดกันเกินไปบนโมบาย
                        callback: function(val, index) {
                            const label = labels[index];
                            return label.length > 25 ? label.substr(0, 25) + '...' : label;
                        }
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Outfit' },
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

/**
 * 4.3 วาดกราฟวงกลมแยกชั้นเรียน
 */
function drawGradesChart(gradeCounts) {
    const ctx = document.getElementById("gradesDoughnutChart").getContext("2d");

    if (gradeChartInstance) {
        gradeChartInstance.destroy();
    }

    const labels = Object.keys(gradeCounts);
    const dataValues = Object.keys(gradeCounts).map(key => gradeCounts[key]);

    // เช็คว่ามีข้อมูลสำหรับการวาดกราฟไหม
    const totalData = dataValues.reduce((a, b) => a + b, 0);

    gradeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: totalData > 0 ? dataValues : [1],
                backgroundColor: totalData > 0 ? [
                    '#38bdf8', '#0ea5e9', '#0284c7', // ม.ต้น
                    '#c084fc', '#a855f7', '#8b5cf6'  // ม.ปลาย
                ] : ['rgba(255,255,255,0.05)'],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Sarabun', size: 11 }
                    }
                },
                tooltip: {
                    enabled: totalData > 0,
                    titleFont: { family: 'Sarabun' },
                    bodyFont: { family: 'Sarabun' }
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * 4.4 วาดกราฟวงกลมสาขาโครงงานวิทยาศาสตร์ ม.ปลาย
 */
function drawBranchesChart(branchCounts) {
    const ctx = document.getElementById("branchesDoughnutChart").getContext("2d");

    if (branchChartInstance) {
        branchChartInstance.destroy();
    }

    const labels = Object.keys(branchCounts);
    const dataValues = Object.keys(branchCounts).map(key => branchCounts[key]);

    const totalData = dataValues.reduce((a, b) => a + b, 0);

    branchChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: totalData > 0 ? dataValues : [1],
                backgroundColor: totalData > 0 ? [
                    '#f43f5e', // กายภาพ (ชมพู/แดงสด)
                    '#10b981', // ชีวภาพ (เขียว)
                    '#f59e0b'  // ประยุกต์ (ส้ม/เหลือง)
                ] : ['rgba(255,255,255,0.05)'],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Sarabun', size: 10 }
                    }
                },
                tooltip: {
                    enabled: totalData > 0,
                    titleFont: { family: 'Sarabun' },
                    bodyFont: { family: 'Sarabun' }
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * 5. แสดงผลตารางข้อมูลรายชื่อผู้ตอบแบบสำรวจ
 */
function renderDataTable() {
    const tbody = document.getElementById("surveyTableBody");
    const noData = document.getElementById("noDataContainer");
    tbody.innerHTML = "";

    if (filteredSurveys.length === 0) {
        noData.style.display = "block";
        document.getElementById("surveyTable").style.display = "none";
        return;
    }

    noData.style.display = "none";
    document.getElementById("surveyTable").style.display = "table";

    filteredSurveys.forEach((survey, index) => {
        const tr = document.createElement("tr");

        // สร้าง Badges ของกิจกรรมที่สนใจ
        let interestBadges = "";
        if (survey.interests && Array.isArray(survey.interests)) {
            survey.interests.forEach(interest => {
                // หากเป็นโครงงาน (ID=1) ให้แนบสาขาย่อยด้วย
                if (interest.id === 1 && interest.branch) {
                    interestBadges += `<span class="td-badge project-branch">🔬 โครงงานวิทยาศาสตร์ (${interest.branch})</span>`;
                } else {
                    interestBadges += `<span class="td-badge">${interest.name}</span>`;
                }
            });
        }

        tr.innerHTML = `
            <td style="font-family: var(--font-en); font-weight:600;">${index + 1}</td>
            <td style="font-family: var(--font-en);">${survey.student_id}</td>
            <td>
                <div class="td-student">
                    <strong>${survey.student_name}</strong>
                    <span class="td-student-sub">ลงทะเบียนเมื่อ: ${new Date(survey.created_at).toLocaleString('th-TH')}</span>
                </div>
            </td>
            <td>${survey.class_level}/${survey.class_room} (เลขที่ ${survey.class_no})</td>
            <td>${interestBadges}</td>
            <td style="text-align: center;">
                <button class="btn-delete" onclick="deleteSurveyEntry(${survey.id}, '${survey.student_name}')" title="ลบรายการ">
                    🗑️
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * 6. ค้นหาและกรองตารางรายชื่อ
 */
function handleTableSearchAndFilter() {
    const searchQuery = document.getElementById("tableSearch").value.toLowerCase().trim();
    const classFilter = document.getElementById("filterClass").value;
    const activityFilter = document.getElementById("filterActivity").value;

    filteredSurveys = allSurveys.filter(survey => {
        // เงื่อนไขที่ 1: ค้นหารายชื่อหรือรหัสประจำตัว
        const matchSearch = survey.student_name.toLowerCase().includes(searchQuery) || 
                            survey.student_id.includes(searchQuery);
        
        // เงื่อนไขที่ 2: กรองระดับชั้น (ม.1 - ม.6)
        const matchClass = classFilter === "" ? true : (survey.class_level === classFilter);

        // เงื่อนไขที่ 3: กรองด้วยกิจกรรมที่สนใจ
        let matchActivity = true;
        if (activityFilter !== "") {
            const actId = parseInt(activityFilter);
            matchActivity = survey.interests && survey.interests.some(interest => interest.id === actId);
        }

        return matchSearch && matchClass && matchActivity;
    });

    updateMetricsAndCharts();
    renderDataTable();
}

/**
 * 7. ลบข้อมูลทีละคน (พร้อมตรวจสอบการยืนยันตัวตน)
 */
async function deleteSurveyEntry(id, studentName) {
    if (!confirm(`คุณแน่ใจว่าต้องการลบข้อมูลแบบสำรวจของ "${studentName}" หรือไม่? ข้อมูลนี้จะหายไปโดยถาวร`)) {
        return;
    }

    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from("student_surveys")
                .delete()
                .eq("id", id);

            if (error) throw error;
            showToast("ลบสำเร็จ", `ลบข้อมูลของ ${studentName} ออกจาก Supabase แล้ว`, "success");
        } else {
            // ลบจาก LocalStorage
            let localData = localStorage.getItem("student_surveys");
            if (localData) {
                let surveys = JSON.parse(localData);
                surveys = surveys.filter(s => s.id !== id);
                localStorage.setItem("student_surveys", JSON.stringify(surveys));
            }
            showToast("ลบสำเร็จ (โหมดจำลอง)", `ลบข้อมูลของ ${studentName} ออกแล้ว`, "success");
        }

        // ดึงข้อมูลและอัปเดตระบบใหม่
        await fetchSurveyData();

    } catch (error) {
        console.error("Delete Error:", error);
        showToast("เกิดข้อผิดพลาด", "ไม่สามารถลบข้อมูลได้: " + error.message, "error");
    }
}

/**
 * 8. ส่งออกข้อมูลเป็น Excel CSV (พร้อมรองรับภาษาไทยผ่าน UTF-8 BOM)
 */
function exportDataToCSV() {
    if (filteredSurveys.length === 0) {
        showToast("ไม่มีข้อมูลส่งออก", "ไม่พบข้อมูลนักเรียนในการกรองสำหรับการดาวน์โหลด", "error");
        return;
    }

    // สร้าง Header ของตาราง CSV
    let csvContent = "ลำดับ,รหัสประจำตัวนักเรียน,ชื่อ-นามสกุล,ระดับชั้น,ห้อง,เลขที่,กิจกรรมทั้งหมดที่สนใจ,รายละเอียดโครงงาน (สาขาย่อย)\n";

    filteredSurveys.forEach((survey, index) => {
        // ดึงชื่อกิจกรรมมารวมกัน คั่นด้วยเครื่องหมาย |
        const activitiesText = survey.interests 
            ? survey.interests.map(i => i.name).join(" | ") 
            : "";
        
        // ค้นหารายละเอียดสาขาย่อยโครงงานวิทยาศาสตร์
        const projectBranchObj = survey.interests 
            ? survey.interests.find(i => i.id === 1) 
            : null;
        const branchText = projectBranchObj ? projectBranchObj.branch : "-";

        // ล้างเครื่องหมายจุลภาค (Comma) ในตัวแปรข้อความเพื่อป้องกัน CSV พัง
        const cleanName = survey.student_name.replace(/,/g, " ");
        const cleanActivities = activitiesText.replace(/,/g, ";");
        const cleanBranch = branchText.replace(/,/g, " ");

        csvContent += `${index + 1},${survey.student_id},${cleanName},${survey.class_level},${survey.class_room},${survey.class_no},"${cleanActivities}","${cleanBranch}"\n`;
    });

    // แปลงเนื้อหาเป็น Blob และเพิ่ม Byte Order Mark (BOM) สำหรับภาษาไทย
    const universalBOM = "\uFEFF";
    const blob = new Blob([universalBOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // สร้างดาวน์โหลดผ่านลิงก์
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานข้อมูลสัปดาห์วิทยาศาสตร์_มข_2569.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("ส่งออกสำเร็จ", "ส่งออกไฟล์ข้อมูลรายงานเรียบร้อยแล้ว", "success");
}

/**
 * 9. ระบบจำลองข้อมูลผู้สมัครลงทะเบียน (Mock Data Generator)
 * สร้างข้อมูลจำลอง 20 คน เพื่อประโยชน์ในการแสดงแดชบอร์ดทดสอบสถิติ
 */
async function generateMockData() {
    const mockFirstNames = ["สมชาย", "วิภา", "กิตติ", "พรเพ็ญ", "อนุรักษ์", "นงลักษณ์", "ธนา", "ศิริพร", "เจษฎา", "รุ่งเรือง", "ชลดา", "อิทธิพล", "นริศรา", "ณัฐพงศ์", "สุจิตรา", "เกรียงไกร", "พัชราภรณ์", "สุรศักดิ์", "ดวงพร", "ปิยะ"];
    const mockLastNames = ["รักสงบ", "ใจดี", "เจริญรุ่งเรือง", "เลิศปัญญา", "แก้วมณี", "สุขสวัสดิ์", "พาณิชย์", "บุญส่ง", "มงคล", "ดีเลิศ", "งามจิต", "ไพโรจน์", "รุ่งปรีชา", "โสภณ", "เรืองเดช", "สิงหราช", "จันทรา", "ทองดี", "ทรัพย์มหาศาล", "ศิริบุตร"];
    const classRooms = ["1", "2", "3", "5/1", "4/2"];

    const mockSurveys = [];

    for (let i = 0; i < 20; i++) {
        // สุ่มชื่อและข้อมูลนักเรียน
        const fName = mockFirstNames[Math.floor(Math.random() * mockFirstNames.length)];
        const lName = mockLastNames[Math.floor(Math.random() * mockLastNames.length)];
        const studentName = `${fName} ${lName}`;
        
        // สุ่มรหัส 5 หลัก
        const studentId = Math.floor(10000 + Math.random() * 90000).toString();
        
        // สุ่มระดับชั้น
        const classLevel = `ม.${Math.floor(1 + Math.random() * 6)}`;
        const classRoom = classRooms[Math.floor(Math.random() * classRooms.length)];
        const classNo = Math.floor(1 + Math.random() * 45);

        // วิเคราะห์ว่านักเรียนเป็น ม.ต้น หรือ ม.ปลาย
        const isJunior = ["ม.1", "ม.2", "ม.3"].includes(classLevel);
        const selectedInterests = [];

        // สุ่มกิจกรรม (เลือก 1 กิจกรรมเท่านั้นตามกติกาใหม่)
        if (isJunior) {
            // กิจกรรม ม.ต้น และ กิจกรรมทั่วไป (6, 7, 8, 9, 10)
            const availableJuniorIds = [6, 7, 8, 9, 10];
            const selectedId = availableJuniorIds[Math.floor(Math.random() * availableJuniorIds.length)];
            
            selectedInterests.push({
                id: selectedId,
                name: ACTIVITY_NAMES[selectedId]
            });
        } else {
            // กิจกรรม ม.ปลาย และ กิจกรรมทั่วไป (1, 2, 3, 4, 5, 6, 8, 9, 10)
            const availableSeniorIds = [1, 2, 3, 4, 5, 6, 8, 9, 10];
            const selectedId = availableSeniorIds[Math.floor(Math.random() * availableSeniorIds.length)];
            
            const interestObj = {
                id: selectedId,
                name: ACTIVITY_NAMES[selectedId]
            };
            
            // ถ้าเป็นโครงงานวิทย์ (ID=1) ให้เพิ่มฟิลด์สาขาโครงงาน
            if (selectedId === 1) {
                const branches = ["สาขากายภาพ", "สาขาชีวภาพ", "สาขาวิทยาศาสตร์ประยุกต์"];
                interestObj.branch = branches[Math.floor(Math.random() * branches.length)];
            }
            
            selectedInterests.push(interestObj);
        }

        const surveyItem = {
            student_name: studentName,
            student_id: studentId,
            class_level: classLevel,
            class_room: classRoom,
            class_no: classNo,
            interests: selectedInterests
        };

        if (!supabaseClient) {
            surveyItem.id = Date.now() + i;
            surveyItem.created_at = new Date(Date.now() - i * 60000 * 60).toISOString(); // แรนดอมเวลาทำรายการย้อนหลัง
        }

        mockSurveys.push(surveyItem);
    }

    try {
        if (supabaseClient) {
            // เขียนข้อมูลจำลองชุดใหญ่ลง Supabase
            const { error } = await supabaseClient
                .from("student_surveys")
                .insert(mockSurveys);

            if (error) throw error;
            showToast("จำลองข้อมูลสำเร็จ", "เพิ่มข้อมูลจำลอง 20 แถวลง Supabase เรียบร้อย", "success");
        } else {
            // เขียนลง LocalStorage
            let localData = localStorage.getItem("student_surveys");
            let surveys = localData ? JSON.parse(localData) : [];
            
            mockSurveys.forEach(mockItem => {
                surveys.push(mockItem);
            });
            
            localStorage.setItem("student_surveys", JSON.stringify(surveys));
            showToast("จำลองข้อมูลสำเร็จ (โหมดจำลอง)", "เพิ่มข้อมูลจำลอง 20 แถวลงในเบราว์เซอร์แล้ว", "success");
        }

        // ดึงข้อมูลอีกรอบเพื่อรีเฟรชหน้าสถิติ
        await fetchSurveyData();

    } catch (error) {
        console.error("Mock Data Generation Error:", error);
        showToast("เกิดข้อผิดพลาด", "ไม่สามารถสร้างข้อมูลจำลองได้: " + error.message, "error");
    }
}

/**
 * 10. ล้างข้อมูลทั้งหมดในฐานข้อมูล (ความปลอดภัย 2 ชั้น)
 */
async function clearAllSurveyData() {
    // ชั้นที่ 1
    if (!confirm("คุณแน่ใจจริงๆ หรือที่จะลบข้อมูลแบบสำรวจทั้งหมด? ข้อมูลทั้งหมดของนักเรียนจะถูกลบอย่างถาวรและไม่สามารถเรียกคืนได้!")) {
        return;
    }

    // ชั้นที่ 2
    const verificationText = prompt("กรุณายืนยันการดำเนินการ โดยการพิมพ์คำว่า 'DELETE ALL DATA' ลงในช่องข้อความ:");
    if (verificationText !== "DELETE ALL DATA") {
        showToast("ยกเลิกการลบ", "พิมพ์คำยืนยันไม่ถูกต้อง ระบบได้ยกเลิกการล้างข้อมูลเพื่อความปลอดภัย", "info");
        return;
    }

    try {
        if (supabaseClient) {
            // ลบแถวทั้งหมดในตาราง Supabase
            const { error } = await supabaseClient
                .from("student_surveys")
                .delete()
                .neq("id", 0); // ลบทุกรายการที่มี ID ไม่เท่ากับ 0 (ครอบคลุมทั้งหมด)

            if (error) throw error;
            showToast("ล้างระบบเรียบร้อย", "ลบข้อมูลทั้งหมดจากฐานข้อมูล Supabase สำเร็จ", "success");
        } else {
            // เคลียร์ LocalStorage
            localStorage.removeItem("student_surveys");
            showToast("ล้างระบบเรียบร้อย (โหมดจำลอง)", "ลบข้อมูลแบบสำรวจทั้งหมดในเบราว์เซอร์สำเร็จ", "success");
        }

        // ดึงข้อมูลและรีเซ็ตการแสดงผล
        await fetchSurveyData();

    } catch (error) {
        console.error("Clear All Data Error:", error);
        showToast("เกิดข้อผิดพลาด", "ไม่สามารถล้างข้อมูลแบบสำรวจได้: " + error.message, "error");
    }
}

/**
 * 11. แสดงหน้าต่างแจ้งเตือน Toast ในหน้า Dashboard
 */
function showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add("show");
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 4000);
}
