// ====================================================================
// SUPABASE CONFIGURATION — เฉพาะระบบเยี่ยมชมบูธ "แม่ไก่ใส่ใจลูกเจี๊ยบ"
// ====================================================================
// ระบบบูธใช้โปรเจกต์ Supabase คนละตัวกับระบบแบบสำรวจเดิม (index.html)
// จึงแยกไฟล์ตั้งค่าออกจาก config.js เพื่อไม่ให้กระทบระบบเดิม
// หากปล่อยค่าว่างไว้ ระบบบูธจะทำงานในโหมด LocalStorage (Demo) ทันที

const BOOTH_SUPABASE_CONFIG = {
    // URL ของโครงการ Supabase สำหรับระบบบูธ
    URL: "https://vhbbgjbojlifelncyide.supabase.co",

    // Publishable Key (คีย์สาธารณะ ใช้ฝั่งเบราว์เซอร์ได้ ปลอดภัยด้วย Row Level Security)
    ANON_KEY: "sb_publishable_Vb8l9vbfNle8UczaCk4iHQ_5-bqIXd4"
};

/**
 * ตรวจสอบว่าตั้งค่า Supabase ของระบบบูธครบถ้วนหรือไม่
 * @returns {boolean}
 */
function isBoothSupabaseConfigured() {
    return typeof BOOTH_SUPABASE_CONFIG !== "undefined" &&
           BOOTH_SUPABASE_CONFIG.URL &&
           BOOTH_SUPABASE_CONFIG.URL.trim() !== "" &&
           BOOTH_SUPABASE_CONFIG.ANON_KEY &&
           BOOTH_SUPABASE_CONFIG.ANON_KEY.trim() !== "";
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { BOOTH_SUPABASE_CONFIG, isBoothSupabaseConfigured };
}
