// ====================================================================
// BOOTH SATISFACTION DASHBOARD — สรุปผลการประเมินบูธ
// บูธ "แม่ไก่ใส่ใจลูกเจี๊ยบ" โรงเรียนอุเทนพัฒนา สพม.นครพนม
// ====================================================================

/** รหัสผ่านเข้าแดชบอร์ด (แก้ไขได้ตามต้องการ) */
const BOOTH_DASHBOARD_PASSCODE = "1234";

let boothSupabase = null;
let boothRows = [];
const chartInstances = {};

/**
 * 1. ระบบตรวจสอบรหัสผ่านก่อนเข้าใช้งาน
 */
function validateBoothPasscode() {
    const passcode = document.getElementById("adminPasscode").value;
    const errorDiv = document.getElementById("passcodeError");

    if (passcode === BOOTH_DASHBOARD_PASSCODE) {
        sessionStorage.setItem("booth_admin_authenticated", "true");
        openBoothDashboard();
    } else {
        errorDiv.style.display = "block";
        document.getElementById("adminPasscode").value = "";
    }
}

function openBoothDashboard() {
    document.getElementById("passwordGate").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";
    initBoothConnection();
    loadBoothDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("adminPasscode").addEventListener("keypress", e => {
        if (e.key === "Enter") validateBoothPasscode();
    });

    // ถ้าเคยเข้าสู่ระบบในแท็บนี้แล้ว ไม่ต้องถามซ้ำ
    if (sessionStorage.getItem("booth_admin_authenticated") === "true") {
        openBoothDashboard();
    }
});

/**
 * 2. เชื่อมต่อฐานข้อมูล
 */
function initBoothConnection() {
    const statusBanner = document.getElementById("connectionStatus");
    const statusText = document.getElementById("statusText");

    if (typeof isBoothSupabaseConfigured === "function" && isBoothSupabaseConfigured()) {
        try {
            boothSupabase = supabase.createClient(BOOTH_SUPABASE_CONFIG.URL, BOOTH_SUPABASE_CONFIG.ANON_KEY);
            statusBanner.className = "status-banner supabase-active";
            statusText.innerText = "เชื่อมต่อระบบฐานข้อมูล Supabase สำเร็จ (ข้อมูลออนไลน์)";
            return;
        } catch (error) {
            console.error("Supabase Connection Error:", error);
        }
    }

    boothSupabase = null;
    statusBanner.className = "status-banner local-demo";
    statusText.innerText = "โหมดจำลอง (LocalStorage) - แสดงเฉพาะข้อมูลที่บันทึกไว้ในเครื่องนี้";
}

/**
 * 3. โหลดข้อมูลและวาดผลลัพธ์ทั้งหมด
 */
async function loadBoothDashboard() {
    try {
        if (boothSupabase) {
            const { data, error } = await boothSupabase
                .from(BOOTH_INFO.tableName)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            boothRows = data || [];
        } else {
            const localData = localStorage.getItem(BOOTH_INFO.storageKey);
            boothRows = localData ? JSON.parse(localData).slice().reverse() : [];
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        boothRows = [];
        showDashboardToast("โหลดข้อมูลไม่สำเร็จ", error.message, "error");
    }

    document.getElementById("reportGeneratedAt").innerText =
        `ข้อมูล ณ วันที่ ${new Date().toLocaleString("th-TH")}`;

    renderMetrics();
    renderInterpretTable();
    // ถ้าวาดกราฟไม่สำเร็จ ต้องไม่ทำให้ตารางสรุปและทะเบียนผู้เข้าชมหายไปด้วย
    try {
        renderCharts();
    } catch (error) {
        console.error("Chart Render Error:", error);
        showChartUnavailable();
    }
    renderComments();
    renderVisitorTable();
}

/**
 * 3.0 แจ้งเตือนกรณีโหลดไลบรารีกราฟ (Chart.js) ไม่สำเร็จ เช่น อินเทอร์เน็ตในงานไม่เสถียร
 * ตารางและข้อมูลส่วนอื่นยังใช้งานได้ตามปกติ
 */
function showChartUnavailable() {
    document.querySelectorAll(".chart-container").forEach(container => {
        container.innerHTML = `
            <div style="height:100%; display:flex; align-items:center; justify-content:center; text-align:center; color:var(--text-muted); font-size:0.88rem; padding:15px;">
                ไม่สามารถโหลดไลบรารีกราฟได้ (ต้องต่ออินเทอร์เน็ต)<br>ข้อมูลในตารางสรุปด้านล่างยังใช้งานได้ตามปกติ
            </div>
        `;
    });
}

/**
 * 3.1 ดึงคะแนนทั้งหมดของคำถามหนึ่งข้อจากผู้ตอบทุกคน
 * @param {string} key
 * @returns {number[]}
 */
function getScoresForQuestion(key) {
    return boothRows
        .map(row => (row.ratings ? Number(row.ratings[key]) : NaN))
        .filter(v => !isNaN(v));
}

/**
 * 3.2 ค่าเฉลี่ยรายบุคคลของผู้ตอบทุกคน (ใช้คำนวณภาพรวมและ S.D.)
 * @returns {number[]}
 */
function getPersonalAverages() {
    return boothRows.map(row => {
        if (row.avg_score !== null && row.avg_score !== undefined && !isNaN(Number(row.avg_score))) {
            return Number(row.avg_score);
        }
        // เผื่อกรณีข้อมูลเก่าที่ยังไม่มีคอลัมน์ avg_score ให้คำนวณจาก ratings
        const values = row.ratings ? Object.values(row.ratings).map(Number) : [];
        return calcMean(values);
    }).filter(v => v !== null && !isNaN(v));
}

/**
 * 4. การ์ดสรุปตัวเลขด้านบน
 */
function renderMetrics() {
    const averages = getPersonalAverages();
    const overallMean = calcMean(averages);
    const sd = calcSD(averages);
    const level = interpretScore(overallMean);

    document.getElementById("metricTotal").innerText = boothRows.length;
    document.getElementById("metricAvg").innerText = overallMean === null ? "0.00" : overallMean.toFixed(2);
    document.getElementById("metricAvgLevel").innerText = overallMean === null ? "-" : `ระดับ${level.text}`;
    document.getElementById("metricSD").innerText = sd === null ? "0.00" : sd.toFixed(2);

    const highCount = averages.filter(v => v >= 3.51).length;
    const percent = averages.length === 0 ? 0 : Math.round((highCount / averages.length) * 100);
    document.getElementById("metricHighPercent").innerText = `${percent}%`;

    // จำนวนบุคลากรทางการศึกษาที่สนใจนำหลักสูตรไปปรับใช้
    const educators = boothRows.filter(row => EDUCATOR_TYPES.includes(row.visitor_type));
    const interestedCount = educators.filter(row =>
        row.adoption_interest && row.adoption_interest.startsWith("สนใจ")
    ).length;

    document.getElementById("metricAdoption").innerText = interestedCount;
    document.getElementById("metricAdoptionDesc").innerText =
        `คน จากบุคลากรทางการศึกษาทั้งหมด ${educators.length} คน`;
}

/**
 * 5. ตารางค่าเฉลี่ย / S.D. / แปลผล รายข้อและรายด้าน
 */
function renderInterpretTable() {
    const tbody = document.getElementById("interpretTableBody");

    if (boothRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:25px;">ยังไม่มีผู้ตอบแบบประเมิน</td></tr>`;
        return;
    }

    // จัดอันดับข้อคำถามตามค่าเฉลี่ย (มาก -> น้อย)
    const questionMeans = ALL_QUESTIONS.map(q => ({
        key: q.key,
        mean: calcMean(getScoresForQuestion(q.key))
    }));
    const ranked = questionMeans
        .filter(item => item.mean !== null)
        .slice()
        .sort((a, b) => b.mean - a.mean);
    const rankMap = {};
    ranked.forEach((item, index) => { rankMap[item.key] = index + 1; });

    let html = "";
    let questionNo = 0;

    RATING_GROUPS.forEach(group => {
        // แถวสรุปของแต่ละด้าน
        const groupScores = group.questions.flatMap(q => getScoresForQuestion(q.key));
        const groupMean = calcMean(groupScores);
        const groupSD = calcSD(groupScores);
        const groupLevel = interpretScore(groupMean);

        html += `
            <tr class="group-row">
                <td>${group.icon} ${group.title}</td>
                <td class="num">${groupMean === null ? "-" : groupMean.toFixed(2)}</td>
                <td class="num">${groupSD === null ? "-" : groupSD.toFixed(2)}</td>
                <td class="num"><span class="level-badge level-${groupLevel.level}">${groupLevel.text}</span></td>
                <td class="num">-</td>
            </tr>
        `;

        group.questions.forEach(question => {
            questionNo++;
            const scores = getScoresForQuestion(question.key);
            const mean = calcMean(scores);
            const sd = calcSD(scores);
            const level = interpretScore(mean);

            html += `
                <tr>
                    <td style="padding-left: 26px;">${questionNo}. ${question.text}</td>
                    <td class="num">${mean === null ? "-" : mean.toFixed(2)}</td>
                    <td class="num">${sd === null ? "-" : sd.toFixed(2)}</td>
                    <td class="num"><span class="level-badge level-${level.level}">${level.text}</span></td>
                    <td class="num">${rankMap[question.key] || "-"}</td>
                </tr>
            `;
        });
    });

    // แถวสรุปรวมทุกด้าน
    const allScores = ALL_QUESTIONS.flatMap(q => getScoresForQuestion(q.key));
    const totalMean = calcMean(allScores);
    const totalSD = calcSD(allScores);
    const totalLevel = interpretScore(totalMean);

    html += `
        <tr class="group-row" style="border-top: 2px solid var(--card-border);">
            <td>รวมเฉลี่ยทุกด้าน (n = ${boothRows.length})</td>
            <td class="num">${totalMean === null ? "-" : totalMean.toFixed(2)}</td>
            <td class="num">${totalSD === null ? "-" : totalSD.toFixed(2)}</td>
            <td class="num"><span class="level-badge level-${totalLevel.level}">${totalLevel.text}</span></td>
            <td class="num">-</td>
        </tr>
    `;

    tbody.innerHTML = html;
}

/**
 * 6. วาดกราฟทั้งหมด
 */
function renderCharts() {
    if (typeof Chart === "undefined") {
        console.warn("Chart.js is not available - skipping charts.");
        showChartUnavailable();
        return;
    }

    const fontConfig = { family: "Sarabun", size: 11 };
    const smallFont = { family: "Sarabun", size: 10 };
    const gridColor = "rgba(255, 255, 255, 0.08)";

    // 6.0 ประเด็นในหลักสูตรที่ผู้เข้าชมสนใจ (จุดขายไหนโดนใจที่สุด)
    const interestCounts = INTEREST_POINTS.map(point =>
        boothRows.filter(row =>
            Array.isArray(row.interest_points) && row.interest_points.includes(point)
        ).length
    );

    drawChart("interestBarChart", {
        type: "bar",
        data: {
            labels: INTEREST_POINTS,
            datasets: [{
                label: "จำนวนผู้สนใจ (คน)",
                data: interestCounts,
                backgroundColor: "rgba(245, 158, 11, 0.75)",
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: fontConfig, bodyFont: fontConfig }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8", font: fontConfig, precision: 0 },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: {
                        color: "#94a3b8",
                        font: smallFont,
                        // ตัดข้อความยาวให้พออ่านได้ในแกน y
                        callback: function (value) {
                            const label = this.getLabelForValue(value);
                            return label.length > 42 ? label.slice(0, 40) + "…" : label;
                        }
                    },
                    grid: { display: false }
                }
            }
        }
    });

    // 6.0.1 ความสนใจนำหลักสูตรไปปรับใช้ (เฉพาะบุคลากรทางการศึกษา)
    const adoptionCounts = ADOPTION_OPTIONS.map(option =>
        boothRows.filter(row => row.adoption_interest === option).length
    );

    drawChart("adoptionBarChart", {
        type: "bar",
        data: {
            labels: ADOPTION_OPTIONS.map(option =>
                option.length > 24 ? option.slice(0, 22) + "…" : option),
            datasets: [{
                label: "จำนวน (คน)",
                data: adoptionCounts,
                backgroundColor: [
                    "rgba(16, 185, 129, 0.75)",
                    "rgba(59, 130, 246, 0.75)",
                    "rgba(129, 140, 248, 0.75)",
                    "rgba(245, 158, 11, 0.75)",
                    "rgba(148, 163, 184, 0.6)"
                ],
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    titleFont: fontConfig,
                    bodyFont: fontConfig,
                    callbacks: {
                        // แสดงข้อความเต็มใน tooltip เพราะแกน y ถูกตัดให้สั้น
                        title: items => ADOPTION_OPTIONS[items[0].dataIndex]
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8", font: fontConfig, precision: 0 },
                    grid: { color: gridColor }
                },
                y: { ticks: { color: "#94a3b8", font: smallFont }, grid: { display: false } }
            }
        }
    });

    // 6.0.2 ผู้เข้าเยี่ยมชมแยกตามภูมิภาค (ผู้ชมมาจากทั่วประเทศ)
    const regionLabels = PROVINCES_BY_REGION.map(group => group.region);
    const regionCounts = PROVINCES_BY_REGION.map(group =>
        boothRows.filter(row => group.provinces.includes(row.province)).length
    );
    const hasRegionData = regionCounts.some(count => count > 0);

    drawChart("regionPieChart", {
        type: "doughnut",
        data: {
            labels: hasRegionData ? regionLabels : ["ยังไม่มีข้อมูล"],
            datasets: [{
                data: hasRegionData ? regionCounts : [1],
                backgroundColor: hasRegionData
                    ? ["#38bdf8", "#4f46e5", "#f59e0b", "#10b981", "#a855f7", "#ef4444"]
                    : ["rgba(255,255,255,0.05)"],
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { color: "#94a3b8", font: smallFont } },
                tooltip: { enabled: hasRegionData, titleFont: fontConfig, bodyFont: fontConfig }
            }
        }
    });

    // 6.1 ค่าเฉลี่ยรายด้าน
    const groupLabels = RATING_GROUPS.map(g => g.title.replace(/^ด้านที่ \d+ /, ""));
    const groupMeans = RATING_GROUPS.map(group => {
        const mean = calcMean(group.questions.flatMap(q => getScoresForQuestion(q.key)));
        return mean === null ? 0 : Number(mean.toFixed(2));
    });

    drawChart("groupBarChart", {
        type: "bar",
        data: {
            labels: groupLabels,
            datasets: [{
                label: "ค่าเฉลี่ย (เต็ม 5)",
                data: groupMeans,
                backgroundColor: [
                    "rgba(245, 158, 11, 0.75)",
                    "rgba(79, 70, 229, 0.75)",
                    "rgba(14, 165, 233, 0.75)",
                    "rgba(16, 185, 129, 0.75)"
                ],
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: fontConfig, bodyFont: fontConfig }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: { color: "#94a3b8", font: fontConfig, stepSize: 1 },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: "#94a3b8", font: fontConfig },
                    grid: { display: false }
                }
            }
        }
    });

    // 6.2 สัดส่วนผู้เข้าเยี่ยมชมแยกตามสถานะ
    const typeCounts = VISITOR_TYPES.map(type =>
        boothRows.filter(row => row.visitor_type === type).length
    );
    const hasTypeData = typeCounts.some(count => count > 0);

    drawChart("visitorTypePieChart", {
        type: "doughnut",
        data: {
            labels: hasTypeData ? VISITOR_TYPES : ["ยังไม่มีข้อมูล"],
            datasets: [{
                data: hasTypeData ? typeCounts : [1],
                backgroundColor: hasTypeData
                    ? ["#f59e0b", "#4f46e5", "#0ea5e9", "#10b981", "#a855f7"]
                    : ["rgba(255,255,255,0.05)"],
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { color: "#94a3b8", font: fontConfig } },
                tooltip: { enabled: hasTypeData, titleFont: fontConfig, bodyFont: fontConfig }
            }
        }
    });

    // 6.3 การกระจายคะแนนความพึงพอใจภาพรวม (1 - 5 ดาว)
    const starCounts = [1, 2, 3, 4, 5].map(star =>
        boothRows.filter(row => Number(row.overall_rating) === star).length
    );

    drawChart("overallBarChart", {
        type: "bar",
        data: {
            labels: ["1 ดาว", "2 ดาว", "3 ดาว", "4 ดาว", "5 ดาว"],
            datasets: [{
                label: "จำนวนผู้ประเมิน (คน)",
                data: starCounts,
                backgroundColor: [
                    "rgba(239, 68, 68, 0.7)",
                    "rgba(249, 115, 22, 0.7)",
                    "rgba(245, 158, 11, 0.7)",
                    "rgba(59, 130, 246, 0.7)",
                    "rgba(16, 185, 129, 0.7)"
                ],
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: fontConfig, bodyFont: fontConfig }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8", font: fontConfig, precision: 0 },
                    grid: { color: gridColor }
                },
                x: { ticks: { color: "#94a3b8", font: fontConfig }, grid: { display: false } }
            }
        }
    });

    // 6.4 ช่องทางที่ทราบข่าว
    const referralCounts = REFERRAL_SOURCES.map(source =>
        boothRows.filter(row =>
            Array.isArray(row.referral_sources) && row.referral_sources.includes(source)
        ).length
    );

    drawChart("referralBarChart", {
        type: "bar",
        data: {
            labels: REFERRAL_SOURCES,
            datasets: [{
                label: "จำนวน (คน)",
                data: referralCounts,
                backgroundColor: "rgba(129, 140, 248, 0.7)",
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: fontConfig, bodyFont: fontConfig }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8", font: fontConfig, precision: 0 },
                    grid: { color: gridColor }
                },
                y: { ticks: { color: "#94a3b8", font: { family: "Sarabun", size: 10 } }, grid: { display: false } }
            }
        }
    });

    // 6.5 ช่วงเวลาที่เข้าเยี่ยมชม
    const roundCounts = VISIT_ROUNDS.map(round =>
        boothRows.filter(row => row.visit_round === round).length
    );
    const hasRoundData = roundCounts.some(count => count > 0);

    drawChart("roundPieChart", {
        type: "doughnut",
        data: {
            labels: hasRoundData ? VISIT_ROUNDS : ["ยังไม่มีข้อมูล"],
            datasets: [{
                data: hasRoundData ? roundCounts : [1],
                backgroundColor: hasRoundData
                    ? ["#fcd34d", "#8b5cf6"]
                    : ["rgba(255,255,255,0.05)"],
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { color: "#94a3b8", font: fontConfig } },
                tooltip: { enabled: hasRoundData, titleFont: fontConfig, bodyFont: fontConfig }
            }
        }
    });
}

/**
 * 6.6 ตัวช่วยวาด/วาดซ้ำกราฟ (ทำลายกราฟเดิมก่อนเสมอเพื่อกันภาพซ้อน)
 */
function drawChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    chartInstances[canvasId] = new Chart(canvas.getContext("2d"), config);
}

/**
 * 7. แสดงข้อเสนอแนะปลายเปิด
 */
function renderComments() {
    renderCommentList("careerList", "career_interest", "ยังไม่มีผู้ระบุอาชีพที่อยากไปลองทำ");
    renderCommentList("concernList", "adoption_concern", "ยังไม่มีผู้ระบุข้อกังวลในการนำหลักสูตรไปปรับใช้");
    renderCommentList("impressedList", "impressed", "ยังไม่มีผู้เขียนสิ่งที่ประทับใจ");
    renderCommentList("suggestionList", "suggestion", "ยังไม่มีข้อเสนอแนะเพิ่มเติม");
}

function renderCommentList(containerId, field, emptyText) {
    const container = document.getElementById(containerId);
    const items = boothRows.filter(row => row[field] && String(row[field]).trim() !== "");

    if (items.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">${emptyText}</p>`;
        return;
    }

    container.innerHTML = items.map(row => `
        <div class="comment-item">
            <div class="comment-meta">
                ${escapeHtml(row.visitor_name || "ไม่ระบุชื่อ")} · ${escapeHtml(row.visitor_type || "-")}
                · ${escapeHtml(row.organization || "-")} จ.${escapeHtml(row.province || "-")}
            </div>
            <div class="comment-text">${escapeHtml(row[field])}</div>
        </div>
    `).join("");
}

/**
 * 8. ตารางทะเบียนผู้เข้าเยี่ยมชม (พร้อมช่องค้นหา)
 */
function renderVisitorTable() {
    const tbody = document.getElementById("visitorTableBody");
    const keyword = (document.getElementById("visitorSearch").value || "").trim().toLowerCase();

    const filtered = boothRows.filter(row => {
        if (!keyword) return true;
        return [row.visitor_name, row.organization, row.province, row.visitor_type]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(keyword));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:25px;">
            ${boothRows.length === 0 ? "ยังไม่มีผู้ตอบแบบประเมิน" : "ไม่พบข้อมูลที่ตรงกับคำค้นหา"}
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((row, index) => {
        const avg = row.avg_score !== null && row.avg_score !== undefined
            ? Number(row.avg_score)
            : calcMean(row.ratings ? Object.values(row.ratings).map(Number) : []);
        const level = interpretScore(avg);

        return `
            <tr>
                <td class="num">${index + 1}</td>
                <td>${escapeHtml(row.visitor_name || "-")}</td>
                <td>${escapeHtml(row.visitor_type || "-")}</td>
                <td>${escapeHtml(row.organization || "-")}</td>
                <td>${escapeHtml(row.province || "-")}</td>
                <td class="num">${avg === null ? "-" : avg.toFixed(2)}</td>
                <td class="num"><span class="level-badge level-${level.level}">${level.text}</span></td>
                <td>${row.created_at ? new Date(row.created_at).toLocaleString("th-TH") : "-"}</td>
            </tr>
        `;
    }).join("");
}

/**
 * 9. ส่งออกข้อมูลดิบรายบุคคลเป็น CSV (UTF-8 BOM รองรับภาษาไทยใน Excel)
 */
function exportBoothCSV() {
    if (boothRows.length === 0) {
        showDashboardToast("ไม่มีข้อมูล", "ยังไม่มีข้อมูลให้ส่งออก", "error");
        return;
    }

    const questionHeaders = ALL_QUESTIONS.map((q, index) => `ข้อ ${index + 1}`);
    const headers = [
        "ลำดับ", "วันเวลาที่ประเมิน", "ชื่อ-นามสกุล", "เพศ", "สถานะ", "ระดับชั้น",
        "โรงเรียนเดิม/หน่วยงาน", "จังหวัด", "ช่วงเวลาที่เข้าชม", "ช่องทางที่ทราบข่าว",
        "ประเด็นในหลักสูตรที่สนใจ", "อาชีพที่อยากไปลองทำ",
        "ความสนใจนำไปปรับใช้", "ข้อกังวลหากนำไปปรับใช้",
        ...questionHeaders, "ค่าเฉลี่ยรายบุคคล", "คะแนนภาพรวม (ดาว)", "สิ่งที่ประทับใจ", "ข้อเสนอแนะ"
    ];

    const rows = boothRows.map((row, index) => {
        const scores = ALL_QUESTIONS.map(q => (row.ratings && row.ratings[q.key]) || "");
        const avg = row.avg_score !== null && row.avg_score !== undefined
            ? Number(row.avg_score).toFixed(2)
            : "";

        return [
            index + 1,
            row.created_at ? new Date(row.created_at).toLocaleString("th-TH") : "",
            row.visitor_name || "",
            row.gender || "",
            row.visitor_type || "",
            row.edu_level || "",
            row.organization || "",
            row.province || "",
            row.visit_round || "",
            Array.isArray(row.referral_sources) ? row.referral_sources.join(" / ") : "",
            Array.isArray(row.interest_points) ? row.interest_points.join(" / ") : "",
            row.career_interest || "",
            row.adoption_interest || "",
            row.adoption_concern || "",
            ...scores,
            avg,
            row.overall_rating || "",
            row.impressed || "",
            row.suggestion || ""
        ];
    });

    downloadCSV([headers, ...rows], "ข้อมูลดิบผู้เข้าเยี่ยมชมบูธแม่ไก่ใส่ใจลูกเจี๊ยบ.csv");
}

/**
 * 9.1 ส่งออกตารางสรุปค่าเฉลี่ย/S.D./แปลผล เป็น CSV (นำไปวางในรายงานได้ทันที)
 */
function exportSummaryCSV() {
    if (boothRows.length === 0) {
        showDashboardToast("ไม่มีข้อมูล", "ยังไม่มีข้อมูลให้ส่งออก", "error");
        return;
    }

    const table = [["รายการประเมิน", "ค่าเฉลี่ย", "S.D.", "แปลผล"]];
    let questionNo = 0;

    RATING_GROUPS.forEach(group => {
        const groupScores = group.questions.flatMap(q => getScoresForQuestion(q.key));
        const groupMean = calcMean(groupScores);
        const groupSD = calcSD(groupScores);

        table.push([
            group.title,
            groupMean === null ? "" : groupMean.toFixed(2),
            groupSD === null ? "" : groupSD.toFixed(2),
            interpretScore(groupMean).text
        ]);

        group.questions.forEach(question => {
            questionNo++;
            const scores = getScoresForQuestion(question.key);
            const mean = calcMean(scores);
            const sd = calcSD(scores);

            table.push([
                `${questionNo}. ${question.text}`,
                mean === null ? "" : mean.toFixed(2),
                sd === null ? "" : sd.toFixed(2),
                interpretScore(mean).text
            ]);
        });
    });

    const allScores = ALL_QUESTIONS.flatMap(q => getScoresForQuestion(q.key));
    const totalMean = calcMean(allScores);
    const totalSD = calcSD(allScores);

    table.push([
        `รวมเฉลี่ยทุกด้าน (n = ${boothRows.length})`,
        totalMean === null ? "" : totalMean.toFixed(2),
        totalSD === null ? "" : totalSD.toFixed(2),
        interpretScore(totalMean).text
    ]);

    // สรุปความสนใจในหลักสูตร (นับความถี่และคิดเป็นร้อยละของผู้ตอบทั้งหมด)
    table.push([]);
    table.push(["ประเด็นในหลักสูตรที่ผู้เข้าชมสนใจ", "จำนวน (คน)", "ร้อยละ", ""]);
    INTEREST_POINTS.forEach(point => {
        const count = boothRows.filter(row =>
            Array.isArray(row.interest_points) && row.interest_points.includes(point)
        ).length;
        const percent = boothRows.length === 0 ? 0 : (count / boothRows.length) * 100;
        table.push([point, count, percent.toFixed(1), ""]);
    });

    const educators = boothRows.filter(row => EDUCATOR_TYPES.includes(row.visitor_type));
    table.push([]);
    table.push([`ความสนใจนำหลักสูตรไปปรับใช้ (บุคลากรทางการศึกษา n = ${educators.length})`, "จำนวน (คน)", "ร้อยละ", ""]);
    ADOPTION_OPTIONS.forEach(option => {
        const count = boothRows.filter(row => row.adoption_interest === option).length;
        const percent = educators.length === 0 ? 0 : (count / educators.length) * 100;
        table.push([option, count, percent.toFixed(1), ""]);
    });

    downloadCSV(table, "ตารางสรุปผลการประเมินบูธแม่ไก่ใส่ใจลูกเจี๊ยบ.csv");
}

/**
 * 9.2 แปลงอาร์เรย์ 2 มิติเป็นไฟล์ CSV แล้วสั่งดาวน์โหลด
 * @param {Array<Array>} table
 * @param {string} filename
 */
function downloadCSV(table, filename) {
    const csvContent = table.map(row =>
        row.map(cell => `"${String(cell === null || cell === undefined ? "" : cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    // ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยได้ถูกต้อง
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showDashboardToast("ดาวน์โหลดสำเร็จ", `บันทึกไฟล์ ${filename} เรียบร้อยแล้ว`, "success");
}

/**
 * 10. ตัวช่วยทั่วไป
 */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
}

function showDashboardToast(title, message, type = "info") {
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
