// ====================================================================
// STUDENT SURVEY CLIENT-SIDE LOGIC
// ====================================================================

let supabaseClient = null;

// รอโหลด DOM ทั้งหมดเพื่อเริ่มต้นระบบ
document.addEventListener("DOMContentLoaded", () => {
    initDatabase();
    filterActivitiesByGrade(); // กรองกิจกรรมเริ่มต้นตามสถานะ dropdown
});

/**
 * 1. เริ่มต้นระบบฐานข้อมูล (Supabase หรือ LocalStorage fallback)
 */
function initDatabase() {
    const statusBanner = document.getElementById("connectionStatus");
    const statusText = document.getElementById("statusText");

    if (isSupabaseConfigured()) {
        try {
            // สร้าง Supabase Client จาก SDK Global ที่โหลดมาจาก CDN
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
            
            // อัปเดต Banner แสดงสถานะความสำเร็จ
            statusBanner.className = "status-banner supabase-active";
            statusText.innerText = "เชื่อมต่อระบบฐานข้อมูล Supabase สำเร็จ (พร้อมใช้งานจริง)";
            showToast("การเชื่อมต่อฐานข้อมูล", "เชื่อมต่อกับ Supabase เรียบร้อยแล้ว", "success");
        } catch (error) {
            console.error("Supabase Init Error:", error);
            setupFallbackMode("เชื่อมต่อ Supabase ล้มเหลว! ปรับเข้าสู่โหมด LocalStorage แทน");
        }
    } else {
        setupFallbackMode("รันในโหมดจำลอง (LocalStorage Demo) - ข้อมูลจะถูกเก็บในเครื่องนี้เท่านั้น");
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
 * 2. การควบคุมการเลือกการ์ดกิจกรรม (สลับแบบเลือกได้รายการเดียว)
 * @param {number} id 
 */
function toggleActivitySelection(id) {
    // ดึงการ์ดกิจกรรมทั้งหมดออกจากการเลือกก่อน
    const cards = document.querySelectorAll(".activity-card");
    cards.forEach(card => {
        card.classList.remove("selected");
        const statusSpan = card.querySelector(".selection-status");
        if (statusSpan) statusSpan.innerText = "ไม่ได้เลือก";
    });

    // ปิดและเคลียร์ฟิลด์โครงงานย่อยเป็นค่าเริ่มต้น
    const subSettings = document.getElementById("projectSubSettings");
    if (subSettings) {
        subSettings.classList.remove("active");
        document.getElementById("projectBranch").removeAttribute("required");
    }

    // ทำการเลือกการ์ดปัจจุบัน
    const card = document.getElementById(`activity_${id}`);
    const radio = document.getElementById(`check_activity_${id}`);
    
    radio.checked = true;
    card.classList.add("selected");
    
    const statusSpan = card.querySelector(".selection-status");
    if (statusSpan) statusSpan.innerText = "เลือกแล้ว";

    // จัดการเพิ่มเติมหากเป็นกิจกรรมที่ 1 (โครงงานวิทยาศาสตร์ ม.ปลาย)
    if (id === 1) {
        subSettings.classList.add("active");
        document.getElementById("projectBranch").setAttribute("required", "required");
    } else {
        document.getElementById("projectBranch").value = "";
    }
}

/**
 * 2.1 ช่วยอำนวยความสะดวกในการกดที่ตัวการ์ดเพื่อเลือก
 * @param {number} id 
 */
function selectActivityCard(id) {
    const card = document.getElementById(`activity_${id}`);
    // ป้องกันการเลือก หากการ์ดถูกปิดการใช้งานตามระดับชั้น
    if (card.style.opacity === "0.3") return;
    
    const radio = document.getElementById(`check_activity_${id}`);
    radio.checked = true;
    toggleActivitySelection(id);
}

/**
 * 3. กรองประเภทกิจกรรมตามระดับชั้นเรียน (ม.ต้น / ม.ปลาย) เพื่อลดการเลือกผิดกติกา
 */
function filterActivitiesByGrade() {
    const classLevelSelect = document.getElementById("classLevel");
    const selectedClass = classLevelSelect.value;
    
    if (!selectedClass) return;

    const isJunior = ["ม.1", "ม.2", "ม.3"].includes(selectedClass);
    const isSenior = ["ม.4", "ม.5", "ม.6"].includes(selectedClass);

    // ดึงการ์ดกิจกรรมทั้งหมด
    const cards = document.querySelectorAll(".activity-card");
    
    cards.forEach(card => {
        const gradeType = card.getAttribute("data-grade");
        const radio = card.querySelector("input[type='radio']");
        
        // รีเซ็ตการตั้งค่าเบื้องต้น
        card.style.opacity = "1";
        card.style.pointerEvents = "auto";
        
        if (isJunior && gradeType === "high") {
            // ม.ต้น แต่เป็นรายการ ม.ปลาย -> ปิดการใช้งาน
            card.style.opacity = "0.3";
            card.style.pointerEvents = "none";
            if (radio && radio.checked) {
                radio.checked = false;
                card.classList.remove("selected");
                const statusSpan = card.querySelector(".selection-status");
                if (statusSpan) statusSpan.innerText = "ไม่ได้เลือก";
                
                const subSettings = document.getElementById("projectSubSettings");
                subSettings.classList.remove("active");
                document.getElementById("projectBranch").removeAttribute("required");
                document.getElementById("projectBranch").value = "";
            }
        } else if (isSenior && gradeType === "junior") {
            // ม.ปลาย แต่เป็นรายการ ม.ต้น (Science Show) -> ปิดการใช้งาน
            card.style.opacity = "0.3";
            card.style.pointerEvents = "none";
            if (radio && radio.checked) {
                radio.checked = false;
                card.classList.remove("selected");
                const statusSpan = card.querySelector(".selection-status");
                if (statusSpan) statusSpan.innerText = "ไม่ได้เลือก";
            }
        }
    });
}

/**
 * 4. ดาวน์โหลดรูปแบบข้อเสนอโครงงาน Word (.doc) จาก Client-side
 */
function downloadWordTemplate() {
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset="utf-8">
        <title>แบบเสนอเค้าโครงโครงงานวิทยาศาสตร์</title>
        <style>
            body { font-family: 'TH Sarabun PSK', 'Sarabun', sans-serif; font-size: 16pt; line-height: 1.5; }
            h1 { text-align: center; font-size: 20pt; font-weight: bold; margin-bottom: 20px; }
            h2 { font-size: 18pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; }
            .section { margin-bottom: 15px; }
            .field-label { font-weight: bold; }
            .dotted-line { border-bottom: 1px dotted #888; width: 100%; display: inline-block; height: 20px; }
        </style>
    </head>
    <body>
        <h1>แบบเสนอเค้าโครงโครงงานวิทยาศาสตร์ (ม.ปลาย)<br>งานสัปดาห์วิทยาศาสตร์แห่งชาติ 2569 ณ คณะวิทยาศาสตร์ มข.</h1>
        
        <div class="section">
            <p><span class="field-label">ชื่อโครงงาน (ภาษาไทย):</span> .....................................................................................................................................</p>
            <p><span class="field-label">ชื่อโครงงาน (ภาษาอังกฤษ):</span> ...................................................................................................................................</p>
        </div>

        <div class="section">
            <h2>1. ผู้จัดทำโครงงาน</h2>
            <p>1. ชื่อ-นามสกุล: .............................................................................. ชั้น ม. ....../...... เลขที่ ............. รหัสประจำตัว ........................</p>
            <p>2. ชื่อ-นามสกุล: .............................................................................. ชั้น ม. ....../...... เลขที่ ............. รหัสประจำตัว ........................</p>
            <p>3. ชื่อ-นามสกุล: .............................................................................. ชั้น ม. ....../...... เลขที่ ............. รหัสประจำตัว ........................</p>
        </div>

        <div class="section">
            <h2>2. อาจารย์ที่ปรึกษาโครงงาน</h2>
            <p>ชื่อ-นามสกุล: .........................................................................................................................................</p>
        </div>

        <div class="section">
            <h2>3. รายละเอียดเค้าโครงโครงงาน</h2>
            <p><span class="field-label">1. ที่มาและความสำคัญของโครงงาน:</span><br>
            ............................................................................................................................................................................................<br>
            ................===================================================================================================</p>
            
            <p><span class="field-label">2. วัตถุประสงค์ของการศึกษา:</span><br>
            ............................................................................................................................................................................................</p>
            
            <p><span class="field-label">3. สมมติฐานของการศึกษา (ถ้ามี):</span><br>
            ............................................................................................................................................................................................</p>
            
            <p><span class="field-label">4. ตัวแปรที่ศึกษา (ตัวแปรต้น, ตัวแปรตาม, ตัวแปรควบคุม):</span><br>
            ............................................................................................................................................................................................</p>
            
            <p><span class="field-label">5. วิธีดำเนินงานวิจัย (โดยสรุป):</span><br>
            ............................................................................................................................................................................................<br>
            ............................................................................................................................................................................................</p>
            
            <p><span class="field-label">6. ประโยชน์ที่คาดว่าจะได้รับ:</span><br>
            ............................................................................................................................................................................................</p>
            
            <p><span class="field-label">7. เอกสารอ้างอิง:</span><br>
            ............................................................................................................................................................................................</p>
        </div>
    </body>
    </html>
    `;

    // แปลง HTML เป็น Blob และดาวน์โหลดเป็นไฟล์ .doc (MS Word เปิดได้ทันที)
    const blob = new Blob(['\ufeff' + htmlContent], {
        type: 'application/msword;charset=utf-8'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'แบบเสนอเค้าโครงโครงงานวิทยาศาสตร์_มข2569.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast("ดาวน์โหลดสำเร็จ", "ดาวน์โหลดเทมเพลตเสนอโครงงานวิทยาศาสตร์ .doc แล้ว", "info");
}

/**
 * 5. จัดการการบันทึกข้อมูลฟอร์มแบบสำรวจ
 * @param {Event} event 
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    // ดึงข้อมูลนักเรียน
    const studentName = document.getElementById("studentName").value.trim();
    const studentId = document.getElementById("studentId").value.trim();
    const classLevel = document.getElementById("classLevel").value;
    const classRoom = document.getElementById("classRoom").value.trim();
    const classNo = parseInt(document.getElementById("classNo").value);

    // ตรวจสอบความถูกต้องขั้นสูง
    if (!studentName || !studentId || !classLevel || !classRoom || !classNo) {
        showToast("ข้อมูลไม่ครบถ้วน", "กรุณากรอกข้อมูลนักเรียนที่จำเป็นให้ครบถ้วน", "error");
        return;
    }

    if (studentId.length !== 5 || isNaN(studentId)) {
        showToast("ข้อมูลไม่ถูกต้อง", "รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก", "error");
        return;
    }

    // รวบรวมกิจกรรมที่เลือก (เนื่องจากเป็นวิทยุ จะมีตัวเดียวเสมอ)
    const selectedInterests = [];
    const radios = document.querySelectorAll(".activity-grid input[type='radio']");
    
    radios.forEach(radio => {
        if (radio.checked) {
            const activityId = parseInt(radio.id.replace("check_activity_", ""));
            const card = document.getElementById(`activity_${activityId}`);
            const title = card.querySelector(".activity-title").innerText;
            
            const interestItem = {
                id: activityId,
                name: title
            };
            
            // กรณีเป็น โครงงานวิทยาศาสตร์ (ID=1) ให้แนบสาขาย่อยไปด้วย
            if (activityId === 1) {
                const branch = document.getElementById("projectBranch").value;
                if (!branch) {
                    throw new Error("REQUIRED_BRANCH");
                }
                interestItem.branch = branch;
            }
            
            selectedInterests.push(interestItem);
        }
    });

    // ป้องกันการกดส่งโดยไม่เลือกกิจกรรมเลย
    if (selectedInterests.length === 0) {
        showToast("โปรดเลือกกิจกรรม", "กรุณาเลือกรายการประกวดแข่งขันที่คุณสนใจเข้าร่วมจำนวน 1 รายการ", "error");
        return;
    }

    // สร้างอ็อบเจกต์ข้อมูลที่จะบันทึก
    const surveyData = {
        student_name: studentName,
        student_id: studentId,
        class_level: classLevel,
        class_room: classRoom,
        class_no: classNo,
        interests: selectedInterests
    };

    try {
        if (supabaseClient) {
            // โหมดเชื่อมต่อ Supabase จริง
            const { data, error } = await supabaseClient
                .from("student_surveys")
                .insert([surveyData]);

            if (error) throw error;
            showToast("สำเร็จ", "ส่งแบบสำรวจไปยัง Supabase เรียบร้อยแล้ว", "success");
        } else {
            // โหมด LocalStorage Demo Fallback
            let existingData = localStorage.getItem("student_surveys");
            existingData = existingData ? JSON.parse(existingData) : [];
            
            // สร้าง ID จำลองสำหรับแถว
            surveyData.id = Date.now();
            surveyData.created_at = new Date().toISOString();
            
            existingData.push(surveyData);
            localStorage.setItem("student_surveys", JSON.stringify(existingData));
            showToast("สำเร็จ (โหมดจำลอง)", "บันทึกแบบสำรวจลงบนเครื่องเรียบร้อยแล้ว", "success");
        }

        // แสดงการยืนยันความสำเร็จ
        showSuccessView(surveyData);

    } catch (error) {
        console.error("Save Error:", error);
        if (error.message === "REQUIRED_BRANCH" || error === "REQUIRED_BRANCH") {
            showToast("ข้อมูลไม่ครบถ้วน", "กรุณาเลือกสาขาโครงงานวิทยาศาสตร์ที่คุณต้องการสมัคร", "error");
        } else {
            showToast("เกิดข้อผิดพลาด", "ไม่สามารถส่งแบบสำรวจได้: " + error.message, "error");
        }
    }
}

/**
 * 6. แสดงหน้ายืนยันความสำเร็จ
 * @param {Object} data 
 */
function showSuccessView(data) {
    document.getElementById("surveyForm").style.display = "none";
    document.getElementById("successCard").style.display = "block";
    
    document.getElementById("summaryName").innerText = data.student_name;
    document.getElementById("summaryClass").innerText = `${data.class_level}/${data.class_room} เลขที่ ${data.class_no}`;
    document.getElementById("summaryId").innerText = data.student_id;
    document.getElementById("summaryCount").innerText = `${data.interests.length} รายการ`;
    
    // ดันหน้าจอขึ้นด้านบนสุด
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 7. รีเซ็ตกลับไปหน้าฟอร์มเพื่อกรอกใหม่
 */
function backToForm() {
    resetForm();
    document.getElementById("successCard").style.display = "none";
    document.getElementById("surveyForm").style.display = "block";
}

/**
 * 8. ล้างข้อมูลฟอร์มทั้งหมด
 */
function resetForm() {
    document.getElementById("surveyForm").reset();
    
    // รีเซ็ตการ์ดกิจกรรมทั้งหมด
    const cards = document.querySelectorAll(".activity-card");
    cards.forEach(card => {
        card.classList.remove("selected");
        const radio = card.querySelector("input[type='radio']");
        if (radio) radio.checked = false;
        const statusSpan = card.querySelector(".selection-status");
        if (statusSpan) statusSpan.innerText = "ไม่ได้เลือก";
    });

    // ปิดการตั้งค่าของโครงงานวิทยาศาสตร์
    document.getElementById("projectSubSettings").classList.remove("active");
    document.getElementById("projectBranch").removeAttribute("required");

    // รันฟิลเตอร์อีกครั้ง
    filterActivitiesByGrade();
    
    showToast("ล้างข้อมูล", "ล้างแบบฟอร์มเพื่อกรอกใหม่เรียบร้อยแล้ว", "info");
}

/**
 * 9. ระบบสร้างการแจ้งเตือน Toast สวยงาม
 * @param {string} title 
 * @param {string} message 
 * @param {string} type ('success', 'error', 'info')
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
    
    // สั่งแสดงด้วย animation
    setTimeout(() => {
        toast.classList.add("show");
    }, 100);
    
    // ลบการแจ้งเตือนหลังจากผ่านไป 4 วินาที
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 4000);
}
