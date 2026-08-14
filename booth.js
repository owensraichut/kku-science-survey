// ====================================================================
// BOOTH VISIT REGISTRATION & SATISFACTION SURVEY — CLIENT LOGIC
// บูธ "แม่ไก่ใส่ใจลูกเจี๊ยบ" โรงเรียนอุเทนพัฒนา สพม.นครพนม
// ====================================================================

let boothSupabase = null;
let overallRating = 0;

document.addEventListener("DOMContentLoaded", () => {
    initBoothDatabase();
    renderRegisterOptions();
    renderRatingQuestions();
    updateProgress();
});

/**
 * 1. เริ่มต้นระบบฐานข้อมูล (Supabase หรือ LocalStorage fallback)
 */
function initBoothDatabase() {
    const statusBanner = document.getElementById("connectionStatus");
    const statusText = document.getElementById("statusText");

    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
        try {
            boothSupabase = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
            statusBanner.className = "status-banner supabase-active";
            statusText.innerText = "เชื่อมต่อระบบฐานข้อมูล Supabase สำเร็จ (พร้อมรับข้อมูลจริง)";
        } catch (error) {
            console.error("Supabase Init Error:", error);
            boothSupabase = null;
            statusBanner.className = "status-banner local-demo";
            statusText.innerText = "เชื่อมต่อ Supabase ล้มเหลว! ปรับเข้าสู่โหมด LocalStorage แทน";
        }
    } else {
        boothSupabase = null;
        statusBanner.className = "status-banner local-demo";
        statusText.innerText = "รันในโหมดจำลอง (LocalStorage Demo) - ข้อมูลจะถูกเก็บในเครื่องนี้เท่านั้น";
    }
}

/**
 * 2. สร้างตัวเลือกในตอนที่ 1 (สถานะ ระดับการศึกษา ช่วงเวลา และช่องทางที่ทราบข่าว)
 */
function renderRegisterOptions() {
    const typeSelect = document.getElementById("visitorType");
    VISITOR_TYPES.forEach(type => {
        typeSelect.insertAdjacentHTML("beforeend", `<option value="${type}">${type}</option>`);
    });

    const eduSelect = document.getElementById("eduLevel");
    EDU_LEVELS.forEach(level => {
        eduSelect.insertAdjacentHTML("beforeend", `<option value="${level}">${level}</option>`);
    });

    const roundSelect = document.getElementById("visitRound");
    VISIT_ROUNDS.forEach(round => {
        roundSelect.insertAdjacentHTML("beforeend", `<option value="${round}">${round}</option>`);
    });

    const referralGroup = document.getElementById("referralGroup");
    REFERRAL_SOURCES.forEach((source, index) => {
        referralGroup.insertAdjacentHTML("beforeend", `
            <div class="chip">
                <input type="checkbox" id="referral_${index}" value="${source}">
                <label for="referral_${index}">${source}</label>
            </div>
        `);
    });
}

/**
 * 2.1 แสดง/ซ่อนช่องระดับการศึกษา ตามสถานะผู้เข้าเยี่ยมชม
 */
function toggleEduLevel() {
    const visitorType = document.getElementById("visitorType").value;
    const eduGroup = document.getElementById("eduLevelGroup");
    const eduSelect = document.getElementById("eduLevel");
    const isStudent = visitorType === "นักเรียน / นักศึกษา";

    eduGroup.style.display = isStudent ? "flex" : "none";
    if (isStudent) {
        eduSelect.setAttribute("required", "required");
    } else {
        eduSelect.removeAttribute("required");
        eduSelect.value = "";
    }
}

/**
 * 3. สร้างข้อคำถามแบบประเมินความพึงพอใจทั้ง 4 ด้าน จาก booth-questions.js
 */
function renderRatingQuestions() {
    const container = document.getElementById("ratingContainer");
    let questionNo = 0;
    let html = "";

    RATING_GROUPS.forEach(group => {
        html += `<h3 class="rating-group-title">${group.icon} ${group.title}</h3>`;

        group.questions.forEach(question => {
            questionNo++;
            const options = RATING_SCALE.map(scale => `
                <div class="rating-option">
                    <input type="radio" name="q_${question.key}" id="q_${question.key}_${scale.score}"
                           value="${scale.score}" onchange="handleRatingChange('${question.key}')">
                    <label for="q_${question.key}_${scale.score}">
                        <span class="rating-option-score">${scale.score}</span>
                        <span class="rating-option-text">${scale.label}</span>
                    </label>
                </div>
            `).join("");

            html += `
                <div class="rating-item" id="item_${question.key}">
                    <div class="rating-question">
                        <span class="rating-question-no">${questionNo}.</span>
                        <span>${question.text}</span>
                    </div>
                    <div class="rating-options">${options}</div>
                </div>
            `;
        });
    });

    container.innerHTML = html;
}

/**
 * 3.1 เมื่อผู้ใช้เลือกคะแนนในข้อใดข้อหนึ่ง
 * @param {string} key คีย์ของคำถาม
 */
function handleRatingChange(key) {
    const item = document.getElementById(`item_${key}`);
    item.classList.add("answered");
    item.classList.remove("missing");
    updateProgress();
}

/**
 * 3.2 อัปเดตแถบความคืบหน้าและสถานะขั้นตอน
 */
function updateProgress() {
    const total = ALL_QUESTIONS.length;
    const answered = ALL_QUESTIONS.filter(q =>
        document.querySelector(`input[name="q_${q.key}"]:checked`)
    ).length;

    const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
    document.getElementById("progressFill").style.width = `${percent}%`;
    document.getElementById("progressText").innerText = `${answered} / ${total} ข้อ`;

    // อัปเดตแถบขั้นตอนด้านบน
    const step1Done = !!document.getElementById("visitorName").value.trim();
    const step2Done = answered === total;
    const step3Done = overallRating > 0;

    setStepState("step1", step1Done, !step1Done);
    setStepState("step2", step2Done, step1Done && !step2Done);
    setStepState("step3", step3Done, step2Done && !step3Done);
}

function setStepState(id, isDone, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("done", isDone);
    el.classList.toggle("active", isActive && !isDone);
}

/**
 * 4. ให้คะแนนความพึงพอใจในภาพรวมแบบดาว
 * @param {number} score 1 - 5
 */
function setOverallRating(score) {
    overallRating = score;
    const buttons = document.querySelectorAll("#starRating button");
    buttons.forEach((btn, index) => {
        btn.classList.toggle("on", index < score);
    });

    const scale = RATING_SCALE.find(s => s.score === score);
    document.getElementById("starCaption").innerText =
        `${score} ดาว - ${scale ? scale.label : ""}`;
    updateProgress();
}

/**
 * 5. รวบรวมข้อมูลจากฟอร์มและตรวจสอบความครบถ้วน
 * @returns {Object|null} ข้อมูลที่พร้อมบันทึก หรือ null หากไม่ผ่านการตรวจสอบ
 */
function collectBoothFormData() {
    const visitorName = document.getElementById("visitorName").value.trim();
    const gender = document.getElementById("visitorGender").value;
    const visitorType = document.getElementById("visitorType").value;
    const eduLevel = document.getElementById("eduLevel").value;
    const organization = document.getElementById("organization").value.trim();
    const province = document.getElementById("province").value.trim();
    const visitRound = document.getElementById("visitRound").value;
    const contact = document.getElementById("contact").value.trim();

    if (!visitorName || !gender || !visitorType || !organization || !province || !visitRound) {
        showBoothToast("ข้อมูลไม่ครบถ้วน", "กรุณากรอกข้อมูลผู้เข้าเยี่ยมชมในตอนที่ 1 ให้ครบถ้วน", "error");
        document.getElementById("sectionRegister").scrollIntoView({ behavior: "smooth", block: "start" });
        return null;
    }

    if (visitorType === "นักเรียน / นักศึกษา" && !eduLevel) {
        showBoothToast("ข้อมูลไม่ครบถ้วน", "กรุณาเลือกระดับการศึกษาของท่าน", "error");
        document.getElementById("eduLevelGroup").scrollIntoView({ behavior: "smooth", block: "center" });
        return null;
    }

    // ช่องทางที่ทราบข่าว (เลือกได้หลายข้อ)
    const referralSources = Array.from(
        document.querySelectorAll("#referralGroup input[type='checkbox']:checked")
    ).map(input => input.value);

    // คะแนนความพึงพอใจทั้ง 15 ข้อ
    const ratings = {};
    const missingKeys = [];

    ALL_QUESTIONS.forEach(question => {
        const checked = document.querySelector(`input[name="q_${question.key}"]:checked`);
        const item = document.getElementById(`item_${question.key}`);
        if (checked) {
            ratings[question.key] = parseInt(checked.value);
            item.classList.remove("missing");
        } else {
            missingKeys.push(question.key);
            item.classList.add("missing");
        }
    });

    if (missingKeys.length > 0) {
        showBoothToast(
            "ยังตอบไม่ครบ",
            `กรุณาตอบแบบประเมินให้ครบทุกข้อ (ยังเหลืออีก ${missingKeys.length} ข้อ ระบบได้ทำแถบสีแดงไว้ให้แล้ว)`,
            "error"
        );
        document.getElementById(`item_${missingKeys[0]}`).scrollIntoView({ behavior: "smooth", block: "center" });
        return null;
    }

    if (overallRating === 0) {
        showBoothToast("ยังไม่ได้ให้คะแนนภาพรวม", "กรุณาให้คะแนนความพึงพอใจในภาพรวม (ดาว) ในตอนที่ 3", "error");
        document.getElementById("sectionFeedback").scrollIntoView({ behavior: "smooth", block: "center" });
        return null;
    }

    // คำนวณค่าเฉลี่ยของผู้ตอบรายนี้ไว้ล่วงหน้า เพื่อให้แดชบอร์ดสรุปผลได้เร็วขึ้น
    const avgScore = calcMean(Object.values(ratings));

    return {
        visitor_name: visitorName,
        gender: gender,
        visitor_type: visitorType,
        edu_level: eduLevel || null,
        organization: organization,
        province: province,
        visit_round: visitRound,
        contact: contact || null,
        referral_sources: referralSources,
        ratings: ratings,
        overall_rating: overallRating,
        avg_score: avgScore === null ? null : Number(avgScore.toFixed(2)),
        impressed: document.getElementById("impressed").value.trim() || null,
        suggestion: document.getElementById("suggestion").value.trim() || null
    };
}

/**
 * 6. บันทึกแบบประเมิน
 * @param {Event} event
 */
async function handleBoothSubmit(event) {
    event.preventDefault();

    const formData = collectBoothFormData();
    if (!formData) return;

    const submitButton = event.target.querySelector("button[type='submit']");
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.style.opacity = "0.6";
    }

    try {
        if (boothSupabase) {
            const { data: insertedData, error } = await boothSupabase
                .from(BOOTH_INFO.tableName)
                .insert([formData])
                .select();

            if (error) throw error;

            if (insertedData && insertedData.length > 0) {
                formData.id = insertedData[0].id;
                formData.created_at = insertedData[0].created_at;
            }
            showBoothToast("บันทึกสำเร็จ", "ส่งแบบประเมินเข้าสู่ระบบฐานข้อมูลเรียบร้อยแล้ว", "success");
        } else {
            let existingData = localStorage.getItem(BOOTH_INFO.storageKey);
            existingData = existingData ? JSON.parse(existingData) : [];

            formData.id = Date.now();
            formData.created_at = new Date().toISOString();

            existingData.push(formData);
            localStorage.setItem(BOOTH_INFO.storageKey, JSON.stringify(existingData));
            showBoothToast("บันทึกสำเร็จ (โหมดจำลอง)", "บันทึกแบบประเมินลงบนเครื่องนี้เรียบร้อยแล้ว", "success");
        }

        await showBoothSuccessView(formData);
    } catch (error) {
        console.error("Save Error:", error);
        showBoothToast("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกแบบประเมินได้: " + error.message, "error");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.style.opacity = "1";
        }
    }
}

/**
 * 7. แสดงหน้ายืนยันความสำเร็จพร้อมบัตรผู้เข้าเยี่ยมชม
 * @param {Object} data
 */
async function showBoothSuccessView(data) {
    document.getElementById("boothForm").style.display = "none";
    document.querySelector(".booth-steps").style.display = "none";
    document.getElementById("boothSuccessCard").style.display = "block";

    const visitTime = data.created_at ? new Date(data.created_at) : new Date();
    const runningNo = data.id ? String(Number(data.id) % 1000).padStart(3, "0") : "000";

    document.getElementById("ticketVisitId").innerText = `VST-${runningNo}`;
    document.getElementById("ticketVisitorName").innerText = data.visitor_name;
    document.getElementById("ticketVisitorType").innerText =
        data.edu_level ? `${data.visitor_type} (${data.edu_level})` : data.visitor_type;
    document.getElementById("ticketOrganization").innerText = `${data.organization} จ.${data.province}`;
    document.getElementById("ticketVisitRound").innerText = data.visit_round;
    document.getElementById("ticketVisitTime").innerText = visitTime.toLocaleString("th-TH");

    // สรุปคะแนนของผู้ตอบรายนี้
    const myAvg = data.avg_score;
    const myLevel = interpretScore(myAvg);
    document.getElementById("myAvgScore").innerText = myAvg === null ? "-" : myAvg.toFixed(2);
    document.getElementById("myAvgLevel").innerText = `ระดับ${myLevel.text}`;
    document.getElementById("myOverallScore").innerText = data.overall_rating;
    document.getElementById("ticketSatisfaction").innerText =
        `${myAvg === null ? "-" : myAvg.toFixed(2)} คะแนน (ระดับ${myLevel.text})`;

    // สถิติภาพรวมของบูธ
    try {
        const allRows = await fetchBoothRows();
        document.getElementById("visitorCount").innerText = allRows.length;

        const boothAvg = calcMean(allRows.map(row => Number(row.avg_score)));
        const boothLevel = interpretScore(boothAvg);
        document.getElementById("boothAvgScore").innerText = boothAvg === null ? "-" : boothAvg.toFixed(2);
        document.getElementById("boothAvgLevel").innerText = `ระดับ${boothLevel.text}`;
    } catch (error) {
        console.error("Error loading booth stats:", error);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 7.1 ดึงข้อมูลผู้เข้าเยี่ยมชมทั้งหมด (ใช้ทั้งบนหน้าฟอร์มและหน้าแดชบอร์ด)
 * @returns {Promise<Array>}
 */
async function fetchBoothRows() {
    if (boothSupabase) {
        const { data, error } = await boothSupabase
            .from(BOOTH_INFO.tableName)
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
    }

    const localData = localStorage.getItem(BOOTH_INFO.storageKey);
    const rows = localData ? JSON.parse(localData) : [];
    return rows.slice().reverse();
}

/**
 * 8. กลับไปกรอกแบบประเมินของผู้เยี่ยมชมคนถัดไป
 */
function backToBoothForm() {
    resetBoothForm();
    document.getElementById("boothSuccessCard").style.display = "none";
    document.getElementById("boothForm").style.display = "block";
    document.querySelector(".booth-steps").style.display = "flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 9. ล้างข้อมูลในฟอร์มทั้งหมด
 */
function resetBoothForm() {
    document.getElementById("boothForm").reset();

    // ล้างสถานะของข้อคำถามแต่ละข้อ
    document.querySelectorAll(".rating-item").forEach(item => {
        item.classList.remove("answered", "missing");
    });

    // ล้างคะแนนดาวภาพรวม
    overallRating = 0;
    document.querySelectorAll("#starRating button").forEach(btn => btn.classList.remove("on"));
    document.getElementById("starCaption").innerText = "ยังไม่ได้ให้คะแนน";

    // ซ่อนช่องระดับการศึกษาและคืนค่าเริ่มต้นของจังหวัด
    document.getElementById("eduLevelGroup").style.display = "none";
    document.getElementById("eduLevel").removeAttribute("required");
    document.getElementById("province").value = "นครพนม";

    updateProgress();
}

/**
 * 10. ระบบแจ้งเตือนแบบ Toast
 */
function showBoothToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

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
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            if (toast.parentNode === container) container.removeChild(toast);
        }, 300);
    }, 4000);
}

// อัปเดตแถบขั้นตอนเมื่อผู้ใช้พิมพ์ชื่อ
document.addEventListener("input", event => {
    if (event.target && event.target.id === "visitorName") updateProgress();
});
